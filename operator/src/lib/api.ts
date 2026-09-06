import {
  AddressSchema,
  Hex32Schema,
  PolicyVersionSchema,
  RewardLeafSchema,
  SignatureSchema,
  TaskStateSchema,
  type Hex32,
} from '@iroa/protocol';
import { z } from 'zod';

const API_BASE = (import.meta.env.VITE_CONTROL_API_URL ?? '/api').replace(/\/$/, '');
const SESSION_KEY = 'iroa-operator-session-v1';

const SessionSchema = z.object({
  actorIdHash: Hex32Schema,
  csrfToken: z.string().min(16),
  expiresAt: z.number().int().positive(),
}).strict();
const StoredSessionSchema = SessionSchema.extend({ wallet: AddressSchema }).strict();

const NodeSchema = z.object({
  nodeId: Hex32Schema,
  deviceKeyHash: Hex32Schema,
  trustLevel: z.enum(['N0', 'N1', 'N2', 'N3']),
  policyVersion: PolicyVersionSchema,
  status: z.enum(['pending', 'active', 'suspended', 'revoked']),
  agentVersion: z.string().nullable(),
  capacityBucket: z.enum(['idle', 'low', 'medium', 'high']).nullable(),
  lastSeenAt: z.number().int().nonnegative().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict();

const OperatorTaskSchema = z.object({
  taskId: Hex32Schema,
  state: TaskStateSchema,
  policyVersion: PolicyVersionSchema,
  assignedNodeId: Hex32Schema.nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict();

const RewardRecordSchema = z.object({
  recordId: Hex32Schema,
  leaf: RewardLeafSchema.nullable(),
  proof: z.array(Hex32Schema).max(64),
  scoreBreakdown: z.object({
    validatedTasks: z.number().int().nonnegative(),
    resultQualityBps: z.number().int().min(0).max(10_000),
    accessibilityQualityBps: z.number().int().min(0).max(10_000),
    securityGate: z.boolean(),
  }).strict(),
  excludedReasons: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/)).max(32),
}).strict();

export const SETTLEMENT_DISPUTE_REASONS = ['TASK_EXCLUDED', 'SCORE_UNDERSTATED', 'RECEIPT_NOT_COUNTED', 'POLICY_VERSION_MISMATCH', 'OTHER'] as const;
export type SettlementDisputeReason = (typeof SETTLEMENT_DISPUTE_REASONS)[number];

const SettlementDisputeSchema = z.object({
  disputeId: z.string().min(1),
  epoch: z.number().int().nonnegative(),
  operatorIdHash: Hex32Schema,
  nodeId: Hex32Schema.nullable(),
  reasonCode: z.enum(SETTLEMENT_DISPUTE_REASONS),
  evidenceHash: Hex32Schema,
  note: z.string(),
  status: z.enum(['open', 'upheld', 'rejected']),
  resolutionNote: z.string().nullable(),
  openedAt: z.number().int().nonnegative(),
  resolvedAt: z.number().int().nonnegative().nullable(),
}).strict();

const ChallengeSchema = z.object({ nonce: z.string(), expiresAt: z.number().int(), message: z.string().optional() }).strict();
const ErrorSchema = z.object({ error: z.string() }).passthrough();

export type OperatorSession = z.infer<typeof StoredSessionSchema>;
export type OperatorNode = z.infer<typeof NodeSchema>;
export type OperatorTask = z.infer<typeof OperatorTaskSchema>;
export type OperatorRewardRecord = z.infer<typeof RewardRecordSchema>;
export type SettlementDispute = z.infer<typeof SettlementDisputeSchema>;

export class OperatorApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

export function sessionIsActive(session: Pick<OperatorSession, 'expiresAt'> | null, now = Math.floor(Date.now() / 1_000)): boolean {
  return Boolean(session && session.expiresAt > now + 5);
}

export function getStoredSession(): OperatorSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = StoredSessionSchema.parse(JSON.parse(raw));
    if (!sessionIsActive(session)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

async function rawRequest(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' });
  const payload: unknown = await response.json().catch(() => ({ error: 'INVALID_RESPONSE' }));
  if (!response.ok) {
    const parsed = ErrorSchema.safeParse(payload);
    throw new OperatorApiError(parsed.success ? parsed.data.error : 'INVALID_RESPONSE', response.status);
  }
  return payload;
}

async function operatorRequest(path: string, init: RequestInit): Promise<unknown> {
  const session = getStoredSession();
  if (!session) throw new OperatorApiError('SESSION_EXPIRED', 401);
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  headers.set('x-csrf-token', session.csrfToken);
  if (init.body) headers.set('content-type', 'application/json');
  try {
    return await rawRequest(path, { ...init, headers });
  } catch (error) {
    if (error instanceof OperatorApiError && error.status === 401) clearStoredSession();
    throw error;
  }
}

export async function requestSiweChallenge(input: { domain: string; uri: string; chainId: number }) {
  return ChallengeSchema.parse(await rawRequest('/v1/auth/siwe/challenge', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  }));
}

export async function authenticateSiwe(message: string, signature: string, wallet: string): Promise<OperatorSession> {
  const validSignature = SignatureSchema.parse(signature);
  const responseSession = SessionSchema.parse(await rawRequest('/v1/auth/siwe', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, signature: validSignature }),
  }));
  const session = StoredSessionSchema.parse({ ...responseSession, wallet: AddressSchema.parse(wallet) });
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function requestNodeChallenge(nodeId: Hex32, deviceAddress: string) {
  return ChallengeSchema.parse(await rawRequest('/v1/auth/nodes/challenge', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nodeId, deviceAddress: AddressSchema.parse(deviceAddress) }),
  }));
}

export async function enrollNode(input: {
  deviceAddress: string;
  deviceKeyHash: Hex32;
  trustLevel: 'N0' | 'N1' | 'N2' | 'N3';
  policyVersion: string;
  challengeNonce: string;
  deviceSignature: string;
}): Promise<OperatorNode> {
  return NodeSchema.parse(await operatorRequest('/v1/nodes/enroll', {
    method: 'POST', body: JSON.stringify({ ...input, deviceAddress: AddressSchema.parse(input.deviceAddress), deviceSignature: SignatureSchema.parse(input.deviceSignature) }),
  }));
}

export async function listNodes(): Promise<OperatorNode[]> {
  return z.array(NodeSchema).parse(await operatorRequest('/v1/operator/nodes', { method: 'GET' }));
}

export async function listTasks(): Promise<OperatorTask[]> {
  return z.array(OperatorTaskSchema).parse(await operatorRequest('/v1/operator/tasks', { method: 'GET' }));
}

export async function listRewards(): Promise<OperatorRewardRecord[]> {
  return z.array(RewardRecordSchema).parse(await operatorRequest('/v1/operator/rewards', { method: 'GET' }));
}

export async function listSettlementDisputes(): Promise<SettlementDispute[]> {
  return z.array(SettlementDisputeSchema).parse(await operatorRequest('/v1/operator/settlements/disputes', { method: 'GET' }));
}

export async function openSettlementDispute(input: { epoch: number; nodeId?: Hex32 | null; reasonCode: SettlementDisputeReason; note: string }): Promise<SettlementDispute> {
  return SettlementDisputeSchema.parse(await operatorRequest('/v1/operator/settlements/disputes', { method: 'POST', body: JSON.stringify(input) }));
}

export async function updateNodeStatus(nodeId: Hex32, status: 'suspended' | 'revoked'): Promise<OperatorNode> {
  return NodeSchema.parse(await operatorRequest(`/v1/nodes/${Hex32Schema.parse(nodeId)}/status`, {
    method: 'POST', body: JSON.stringify({ status }),
  }));
}
