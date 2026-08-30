import { pathToFileURL } from 'node:url';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { AddressSchema, ChainIdSchema, Hex32Schema } from '@iroa/protocol';
import { AuthService, type AuthenticatedActor } from './auth.js';
import { LeaseService } from './leases.js';
import { deriveNodeId, NodeService } from './nodes.js';
import { ReceiptService } from './receipts.js';
import { MemoryStorage, type Storage, type TaskRecord } from './storage.js';
import { TaskService } from './tasks.js';

interface ControlApiConfig {
  sessionSecret: Uint8Array;
  chainId: number;
  receiptVerifyingContract: string;
  complianceOperators: readonly string[];
  storage?: Storage;
  now?: () => number;
}

interface Services {
  auth: AuthService;
  tasks: TaskService;
  nodes: NodeService;
  leases: LeaseService;
  receipts: ReceiptService;
}

const MAX_BODY_BYTES = 64 * 1_024;

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
    throw new Error('JSON_CONTENT_TYPE_REQUIRED');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('REQUEST_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new Error('INVALID_JSON');
  }
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JSON_OBJECT_REQUIRED');
  return value as Record<string, unknown>;
}

function send(response: ServerResponse, status: number, payload: unknown, cookie?: string): void {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  if (cookie) response.setHeader('set-cookie', cookie);
  response.end(JSON.stringify(payload));
}

export function serializePublicTask(task: TaskRecord): Omit<TaskRecord, 'ownerSessionId' | 'assignedNodeId' | 'currentLeaseNonce'> {
  const { ownerSessionId: _ownerSessionId, assignedNodeId: _assignedNodeId, currentLeaseNonce: _currentLeaseNonce, ...safe } = task;
  return safe;
}

function errorStatus(code: string): number {
  if (/(AUTH|SESSION|SIGNATURE|CSRF|OWNER|DEVICE_PROOF|CHALLENGE)/.test(code)) return 401;
  if (/(NOT_FOUND)/.test(code)) return 404;
  if (/(ALREADY|CONFLICT|TRANSITION|NOT_QUEUED|INACTIVE|STALE|EXPIRED|MISMATCH|REQUIRED)/.test(code)) return 409;
  return 400;
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  const code = message.split(':')[0] ?? 'INTERNAL_ERROR';
  return /^[A-Z][A-Z0-9_]{2,63}$/.test(code) ? code : 'INTERNAL_ERROR';
}

function userActor(request: IncomingMessage, services: Services): AuthenticatedActor {
  return services.auth.authenticateCookie(request.headers.cookie, request.headers['x-csrf-token'] as string | undefined);
}

async function nodeActor(request: IncomingMessage, services: Services): Promise<AuthenticatedActor> {
  const nodeId = Hex32Schema.parse(request.headers['x-iroa-node-id']);
  const nonce = String(request.headers['x-iroa-node-challenge'] ?? '');
  const signature = String(request.headers['x-iroa-node-signature'] ?? '');
  const node = await services.nodes.getNode(nodeId);
  return services.auth.authenticateNode({ nodeId, deviceAddress: node.deviceAddress, nonce, signature });
}

async function route(request: IncomingMessage, response: ServerResponse, services: Services): Promise<void> {
  const method = request.method ?? 'GET';
  const url = new URL(request.url ?? '/', 'https://control.iroa.invalid');
  const parts = url.pathname.split('/').filter(Boolean);

  if (method === 'POST' && url.pathname === '/v1/auth/sandbox') {
    const issued = services.auth.issueSandboxSession();
    send(response, 201, { csrfToken: issued.session.csrfToken, expiresAt: issued.session.expiresAt }, issued.cookie);
    return;
  }
  if (method === 'POST' && url.pathname === '/v1/auth/siwe/challenge') {
    const body = objectBody(await readJson(request));
    const challenge = services.auth.issueSiweChallenge({
      domain: String(body.domain ?? ''),
      uri: String(body.uri ?? ''),
      chainId: ChainIdSchema.parse(body.chainId),
    });
    send(response, 201, challenge);
    return;
  }
  if (method === 'POST' && url.pathname === '/v1/auth/siwe') {
    const body = objectBody(await readJson(request));
    const authenticated = await services.auth.authenticateSiwe(
      String(body.message ?? ''),
      String(body.signature ?? ''),
      services.auth.sessionIdFromCookie(request.headers.cookie),
    );
    send(
      response,
      200,
      { actorIdHash: authenticated.actor.idHash, csrfToken: authenticated.session.csrfToken },
      authenticated.cookie,
    );
    return;
  }
  if (method === 'POST' && url.pathname === '/v1/auth/nodes/challenge') {
    const body = objectBody(await readJson(request));
    const challenge = services.auth.issueNodeChallenge(String(body.nodeId ?? ''), String(body.deviceAddress ?? ''));
    send(response, 201, challenge);
    return;
  }
  if (method === 'POST' && url.pathname === '/v1/nodes/enroll') {
    const operator = userActor(request, services);
    const body = objectBody(await readJson(request));
    const deviceKeyHash = Hex32Schema.parse(body.deviceKeyHash);
    const deviceAddress = AddressSchema.parse(body.deviceAddress);
    const nodeId = deriveNodeId(operator.id, deviceKeyHash);
    const deviceProof = await services.auth.authenticateNode({
      nodeId,
      deviceAddress,
      nonce: String(body.challengeNonce ?? ''),
      signature: String(body.deviceSignature ?? ''),
    });
    const node = await services.nodes.enroll(operator, {
      deviceAddress,
      deviceKeyHash,
      trustLevel: body.trustLevel,
      policyVersion: body.policyVersion,
    }, deviceProof);
    send(response, 201, node);
    return;
  }
  if (method === 'POST' && url.pathname === '/v1/nodes/heartbeat') {
    const actor = await nodeActor(request, services);
    send(response, 200, await services.nodes.heartbeat(actor, await readJson(request)));
    return;
  }
  if (method === 'POST' && parts.length === 4 && parts[0] === 'v1' && parts[1] === 'nodes' && parts[3] === 'status') {
    const operator = userActor(request, services);
    const body = objectBody(await readJson(request));
    send(response, 200, await services.nodes.setStatus(operator, parts[2] ?? '', String(body.status ?? '') as never));
    return;
  }
  if (method === 'POST' && url.pathname === '/v1/tasks') {
    send(response, 201, serializePublicTask(await services.tasks.create(userActor(request, services), await readJson(request))));
    return;
  }
  if (method === 'GET' && parts.length === 3 && parts[0] === 'v1' && parts[1] === 'tasks') {
    const actor = userActor(request, services);
    const task = await services.tasks.get(actor, parts[2] ?? '');
    const receipts = await services.receipts.getTaskStatus(task.taskId);
    send(response, 200, { task: serializePublicTask(task), receipts });
    return;
  }
  if (method === 'POST' && parts.length === 4 && parts[0] === 'v1' && parts[1] === 'tasks') {
    const taskId = parts[2] ?? '';
    const action = parts[3];
    if (action === 'approve') {
      send(response, 200, serializePublicTask(await services.tasks.approve(userActor(request, services), taskId, await readJson(request))));
      return;
    }
    if (action === 'cancel') {
      send(response, 200, serializePublicTask(await services.tasks.cancel(userActor(request, services), taskId)));
      return;
    }
    if (action === 'confirm') {
      send(response, 200, serializePublicTask(await services.tasks.confirm(userActor(request, services), taskId)));
      return;
    }
    if (action === 'dispute') {
      send(response, 200, serializePublicTask(await services.tasks.dispute(userActor(request, services), taskId, await readJson(request))));
      return;
    }
    if (action === 'claim') {
      send(response, 200, await services.leases.claim(await nodeActor(request, services), taskId, await readJson(request)));
      return;
    }
    if (action === 'result') {
      send(response, 201, await services.receipts.submitResult(await nodeActor(request, services), await readJson(request)));
      return;
    }
    if (action === 'deletion') {
      send(response, 201, await services.receipts.submitDeletion(await nodeActor(request, services), await readJson(request)));
      return;
    }
  }
  send(response, 404, { error: 'NOT_FOUND' });
}

export function createControlApi(config: ControlApiConfig) {
  const storage = config.storage ?? new MemoryStorage();
  const now = config.now ?? (() => Math.floor(Date.now() / 1_000));
  const chainId = ChainIdSchema.parse(config.chainId);
  const verifyingContract = AddressSchema.parse(config.receiptVerifyingContract);
  const services: Services = {
    auth: new AuthService(config.sessionSecret, now),
    tasks: new TaskService(storage, now),
    nodes: new NodeService(storage, config.complianceOperators, now),
    leases: new LeaseService(storage, now),
    receipts: new ReceiptService(storage, chainId, verifyingContract, now),
  };
  const server = createServer((request, response) => {
    void route(request, response, services).catch((error) => {
      const code = safeErrorCode(error);
      send(response, errorStatus(code), { error: code });
    });
  });
  const leaseSweep = setInterval(() => {
    void services.leases.expireDue().catch(() => undefined);
  }, 10_000);
  leaseSweep.unref();
  server.once('close', () => clearInterval(leaseSweep));
  return server;
}

async function main(): Promise<void> {
  const secret = Buffer.from(process.env.CONTROL_API_SESSION_SECRET ?? '', 'base64url');
  const chainId = Number(process.env.IROA_CHAIN_ID);
  const receiptVerifyingContract = process.env.RECEIPT_VERIFYING_CONTRACT ?? '';
  const complianceOperators = JSON.parse(process.env.COMPLIANCE_OPERATORS_JSON ?? '[]') as string[];
  const port = Number(process.env.PORT ?? '8787');
  const server = createControlApi({ sessionSecret: secret, chainId, receiptVerifyingContract, complianceOperators });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  console.log(`IROA Control API listening on 127.0.0.1:${port}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}

export { AuthService, LeaseService, MemoryStorage, NodeService, ReceiptService, TaskService };
export type { ControlApiConfig };
