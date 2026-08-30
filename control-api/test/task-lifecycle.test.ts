import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Address, Hex32, PolicyVersion, TaskCapsule } from '@iroa/protocol';
import { hashIdentifier } from '../src/audit.js';
import { AuthService, type AuthenticatedActor } from '../src/auth.js';
import { LeaseService } from '../src/leases.js';
import { deriveNodeId, NodeService } from '../src/nodes.js';
import { ReceiptService } from '../src/receipts.js';
import { MemoryStorage } from '../src/storage.js';
import { TaskService } from '../src/tasks.js';
import { serializePublicTask } from '../src/index.js';

const operatorAddress = '0x1111111111111111111111111111111111111111' as Address;
const deviceAddress = '0x2222222222222222222222222222222222222222' as Address;
const wrongNodeId = `0x${'33'.repeat(32)}` as Hex32;
const deviceKeyHash = `0x${'44'.repeat(32)}` as Hex32;
const policyVersion = '1.0.0' as PolicyVersion;
const verifyingContract = '0x5555555555555555555555555555555555555555';
const signature = `0x${'66'.repeat(65)}`;

function actor(type: AuthenticatedActor['type'], id: string, sessionId: string | null): AuthenticatedActor {
  return { type, id, idHash: hashIdentifier(id), sessionId };
}

function capsule(taskId: Hex32, now: number): TaskCapsule {
  return {
    taskId,
    policyVersion,
    trustLevel: 'N1',
    capabilityScope: ['public-information'],
    expiresAt: now + 3_600,
    inputCiphertextRef: `iroa-blob://synthetic/${taskId.slice(2)}`,
    expectedResultSchema: 'iroa-schema://public-information/v1',
    userApprovalHash: `0x${'77'.repeat(32)}`,
  };
}

async function fixture() {
  let now = 1_800_000_000;
  const clock = () => now;
  const storage = new MemoryStorage();
  const tasks = new TaskService(storage, clock);
  const nodes = new NodeService(storage, [operatorAddress], clock);
  const leases = new LeaseService(storage, clock, 300, 120);
  const receipts = new ReceiptService(storage, 31337, verifyingContract, clock);
  const user = actor('user', 'sandbox:test-user', 'session-test-user');
  const operator = actor('operator', operatorAddress, 'session-operator');
  const nodeId = deriveNodeId(operatorAddress, deviceKeyHash);
  const node = actor('node', nodeId, null);
  await nodes.enroll(
    operator,
    { deviceAddress, deviceKeyHash, trustLevel: 'N2', policyVersion },
    node,
  );
  await nodes.setStatus(operator, nodeId, 'active');
  await nodes.heartbeat(node, { agentVersion: '1.0.0', policyVersion, capacityBucket: 'medium' });
  return {
    storage,
    tasks,
    nodes,
    leases,
    receipts,
    user,
    operator,
    node,
    nodeId,
    clock,
    advance(seconds: number) {
      now += seconds;
    },
  };
}

describe('IROA Control API task lifecycle', () => {
  it('does not expose session ownership or lease credentials in a public task', async () => {
    const app = await fixture();
    const taskId = `0x${'20'.repeat(32)}` as Hex32;
    const record = await app.tasks.create(app.user, capsule(taskId, app.clock()));
    const publicRecord = serializePublicTask({
      ...record,
      assignedNodeId: app.nodeId,
      currentLeaseNonce: `0x${'21'.repeat(32)}` as Hex32,
    });

    expect(publicRecord).not.toHaveProperty('ownerSessionId');
    expect(publicRecord).not.toHaveProperty('assignedNodeId');
    expect(publicRecord).not.toHaveProperty('currentLeaseNonce');
  });

  it('requires CSRF proof for every cookie-authenticated state request', () => {
    const auth = new AuthService(Buffer.alloc(32, 1), () => 1_800_000_000);
    const issued = auth.issueSandboxSession();
    expect(() => auth.authenticateCookie(issued.cookie)).toThrow('INVALID_CSRF_TOKEN');
  });

  it('generates SIWE nonces using only EIP-4361 alphanumeric characters', () => {
    const source = readFileSync(new URL('../src/auth.ts', import.meta.url), 'utf8');
    expect(source).toContain("randomBytes(18).toString('hex')");
  });

  it('does not trust an unsigned cookie when selecting the prior session to rotate', () => {
    const auth = new AuthService(Buffer.alloc(32, 2), () => 1_800_000_000);
    const issued = auth.issueSandboxSession();
    const sessionId = issued.session.sessionId;
    expect(auth.sessionIdFromCookie(`iroa_session=${sessionId}.1800003600.invalid-mac`)).toBeNull();
  });

  it('caps outstanding public NODE challenges to prevent memory exhaustion', () => {
    const auth = new AuthService(Buffer.alloc(32, 3), () => 1_800_000_000, 3_600, 300, 4);
    const nodeId = `0x${'21'.repeat(32)}`;
    for (let index = 0; index < 4; index += 1) auth.issueNodeChallenge(nodeId, deviceAddress);
    expect(() => auth.issueNodeChallenge(nodeId, deviceAddress)).toThrow('CHALLENGE_CAPACITY_EXCEEDED');
  });

  it('blocks claim before the user approval transition', async () => {
    const app = await fixture();
    const taskId = `0x${'01'.repeat(32)}` as Hex32;
    await app.tasks.create(app.user, capsule(taskId, app.clock()));
    await expect(
      app.leases.claim(app.node, taskId, { requestId: `0x${'02'.repeat(32)}` }),
    ).rejects.toThrow('TASK_NOT_QUEUED');
  });

  it('allows exactly one lease when two nodes race to claim the same queued task', async () => {
    const app = await fixture();
    const secondKeyHash = `0x${'45'.repeat(32)}` as Hex32;
    const secondAddress = '0x2323232323232323232323232323232323232323' as Address;
    const secondNodeId = deriveNodeId(operatorAddress, secondKeyHash);
    const secondNode = actor('node', secondNodeId, null);
    await app.nodes.enroll(
      app.operator,
      { deviceAddress: secondAddress, deviceKeyHash: secondKeyHash, trustLevel: 'N2', policyVersion },
      secondNode,
    );
    await app.nodes.setStatus(app.operator, secondNodeId, 'active');
    await app.nodes.heartbeat(secondNode, { agentVersion: '1.0.0', policyVersion, capacityBucket: 'low' });

    const taskId = `0x${'03'.repeat(32)}` as Hex32;
    await app.tasks.create(app.user, capsule(taskId, app.clock()));
    await app.tasks.approve(app.user, taskId, { approvalHash: `0x${'77'.repeat(32)}` });
    const results = await Promise.allSettled([
      app.leases.claim(app.node, taskId, { requestId: `0x${'04'.repeat(32)}` }),
      app.leases.claim(secondNode, taskId, { requestId: `0x${'05'.repeat(32)}` }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  it('revokes an expired nonce and rejects a stale Result Receipt after reassignment', async () => {
    const app = await fixture();
    const taskId = `0x${'06'.repeat(32)}` as Hex32;
    await app.tasks.create(app.user, capsule(taskId, app.clock()));
    await app.tasks.approve(app.user, taskId, { approvalHash: `0x${'77'.repeat(32)}` });
    const first = await app.leases.claim(app.node, taskId, { requestId: `0x${'07'.repeat(32)}` });
    app.advance(301);
    await app.leases.expire(taskId, first.nonce);
    await app.nodes.heartbeat(app.node, { agentVersion: '1.0.0', policyVersion, capacityBucket: 'medium' });
    await app.leases.claim(app.node, taskId, { requestId: `0x${'08'.repeat(32)}` });

    await expect(
      app.receipts.submitResult(app.node, {
        chainId: 31337,
        verifyingContract,
        policyVersion,
        nonce: first.nonce,
        taskId,
        nodeId: app.nodeId,
        operatorIdHash: hashIdentifier(operatorAddress),
        startedAt: app.clock() - 10,
        completedAt: app.clock(),
        resultHash: `0x${'09'.repeat(32)}`,
        outcomeCode: 'COMPLETED',
        accessibilityMetricsHash: `0x${'0a'.repeat(32)}`,
        nodeSignature: signature,
      }),
    ).rejects.toThrow('RECEIPT_LEASE_MISMATCH');
  });

  it('rejects an idempotency retry after its lease has expired', async () => {
    const app = await fixture();
    const taskId = `0x${'14'.repeat(32)}` as Hex32;
    const requestId = `0x${'15'.repeat(32)}`;
    await app.tasks.create(app.user, capsule(taskId, app.clock()));
    await app.tasks.approve(app.user, taskId, { approvalHash: `0x${'77'.repeat(32)}` });
    const lease = await app.leases.claim(app.node, taskId, { requestId });
    app.advance(301);
    await app.leases.expire(taskId, lease.nonce);
    await expect(app.leases.claim(app.node, taskId, { requestId })).rejects.toThrow('LEASE_REQUEST_ALREADY_CLOSED');
  });

  it('sweeps expired active leases back to the queued state without knowing their nonce', async () => {
    const app = await fixture();
    const taskId = `0x${'1a'.repeat(32)}` as Hex32;
    await app.tasks.create(app.user, capsule(taskId, app.clock()));
    await app.tasks.approve(app.user, taskId, { approvalHash: `0x${'77'.repeat(32)}` });
    await app.leases.claim(app.node, taskId, { requestId: `0x${'1b'.repeat(32)}` });
    app.advance(301);
    await app.leases.expireDue();
    expect((await app.tasks.get(app.user, taskId)).state).toBe('queued');
  });

  it('rejects a Result Receipt that claims execution began before the lease', async () => {
    const app = await fixture();
    const taskId = `0x${'16'.repeat(32)}` as Hex32;
    await app.tasks.create(app.user, capsule(taskId, app.clock()));
    await app.tasks.approve(app.user, taskId, { approvalHash: `0x${'77'.repeat(32)}` });
    const lease = await app.leases.claim(app.node, taskId, { requestId: `0x${'17'.repeat(32)}` });
    await expect(
      app.receipts.submitResult(app.node, {
        chainId: 31337,
        verifyingContract,
        policyVersion,
        nonce: lease.nonce,
        taskId,
        nodeId: app.nodeId,
        operatorIdHash: hashIdentifier(operatorAddress),
        startedAt: lease.createdAt - 1,
        completedAt: app.clock(),
        resultHash: `0x${'18'.repeat(32)}`,
        outcomeCode: 'COMPLETED',
        accessibilityMetricsHash: `0x${'19'.repeat(32)}`,
        nodeSignature: signature,
      }),
    ).rejects.toThrow('RECEIPT_TIME_OUTSIDE_LEASE');
  });

  it('never executes a cancelled task even when the former node submits a receipt', async () => {
    const app = await fixture();
    const taskId = `0x${'0b'.repeat(32)}` as Hex32;
    await app.tasks.create(app.user, capsule(taskId, app.clock()));
    await app.tasks.approve(app.user, taskId, { approvalHash: `0x${'77'.repeat(32)}` });
    const lease = await app.leases.claim(app.node, taskId, { requestId: `0x${'0c'.repeat(32)}` });
    await app.tasks.cancel(app.user, taskId);
    await expect(
      app.receipts.submitResult(app.node, {
        chainId: 31337,
        verifyingContract,
        policyVersion,
        nonce: lease.nonce,
        taskId,
        nodeId: app.nodeId,
        operatorIdHash: hashIdentifier(operatorAddress),
        startedAt: app.clock(),
        completedAt: app.clock(),
        resultHash: `0x${'0d'.repeat(32)}`,
        outcomeCode: 'COMPLETED',
        accessibilityMetricsHash: `0x${'0e'.repeat(32)}`,
        nodeSignature: signature,
      }),
    ).rejects.toThrow();
  });

  it('rejects a Receipt whose authenticated NODE does not match the lease', async () => {
    const app = await fixture();
    const taskId = `0x${'0f'.repeat(32)}` as Hex32;
    await app.tasks.create(app.user, capsule(taskId, app.clock()));
    await app.tasks.approve(app.user, taskId, { approvalHash: `0x${'77'.repeat(32)}` });
    const lease = await app.leases.claim(app.node, taskId, { requestId: `0x${'10'.repeat(32)}` });
    await expect(
      app.receipts.submitResult(actor('node', wrongNodeId, null), {
        chainId: 31337,
        verifyingContract,
        policyVersion,
        nonce: lease.nonce,
        taskId,
        nodeId: wrongNodeId,
        operatorIdHash: hashIdentifier(operatorAddress),
        startedAt: app.clock(),
        completedAt: app.clock(),
        resultHash: `0x${'11'.repeat(32)}`,
        outcomeCode: 'COMPLETED',
        accessibilityMetricsHash: `0x${'12'.repeat(32)}`,
        nodeSignature: signature,
      }),
    ).rejects.toThrow('RECEIPT_NODE_MISMATCH');
  });

  it('keeps audit and task events append-only and excludes ciphertext references', async () => {
    const app = await fixture();
    const taskId = `0x${'13'.repeat(32)}` as Hex32;
    await app.tasks.create(app.user, capsule(taskId, app.clock()));
    const firstRead = await app.storage.transaction((transaction) => ({
      audit: transaction.listAudit(),
      events: transaction.listTaskEvents(taskId),
      hasAuditMutation: 'updateAudit' in transaction || 'deleteAudit' in transaction,
      hasEventMutation: 'updateTaskEvent' in transaction || 'deleteTaskEvent' in transaction,
    }));
    expect(firstRead.hasAuditMutation).toBe(false);
    expect(firstRead.hasEventMutation).toBe(false);
    expect(JSON.stringify(firstRead.audit)).not.toContain('iroa-blob://');
    expect(firstRead.events).toHaveLength(2);
  });
});
