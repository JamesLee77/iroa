import { z } from 'zod';

const API_BASE = (import.meta.env.VITE_ADMIN_API_URL ?? '/control').replace(/\/$/, '');
const SESSION_KEY = 'iroa-admin-session-v1';
const Hex32 = z.custom<`0x${string}`>((value) => typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value));
const Address = z.custom<`0x${string}`>((value) => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value));
const HexData = z.custom<`0x${string}`>((value) => typeof value === 'string' && /^0x(?:[0-9a-fA-F]{2})*$/.test(value));
const DecimalUint = z.string().regex(/^(0|[1-9][0-9]*)$/);

const IdentitySchema = z.object({
  accessVerified: z.boolean(),
  persona: z.enum(['super_admin', 'treasury', 'compliance', 'read_only']),
}).strict();

const SessionSchema = z.object({
  actorIdHash: Hex32,
  csrfToken: z.string().min(16),
  expiresAt: z.number().int().positive(),
  wallet: Address,
}).strict();

const NodeSchema = z.object({
  nodeId: Hex32,
  deviceKeyHash: Hex32,
  trustLevel: z.enum(['N0', 'N1', 'N2', 'N3']),
  policyVersion: z.string().min(1).max(64),
  status: z.enum(['pending', 'active', 'suspended', 'revoked']),
  agentVersion: z.string().max(64).nullable(),
  capacityBucket: z.enum(['idle', 'low', 'medium', 'high']).nullable(),
  lastSeenAt: z.number().int().nonnegative().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict();

const DisputeSchema = z.object({
  taskId: Hex32,
  evidenceHash: Hex32,
  status: z.enum(['open', 'upheld', 'rejected']),
  openedAt: z.number().int().nonnegative(),
  resolvedAt: z.number().int().nonnegative().nullable(),
  reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
}).strict();

const SettlementSchema = z.object({
  epoch: z.number().int().nonnegative(),
  policyVersion: z.string().min(1).max(64),
  monthlyBudget: DecimalUint,
  totalValidScore: DecimalUint,
  totalReward: DecimalUint,
  capExcludedAmount: DecimalUint,
  roundingExcludedAmount: DecimalUint,
  unusedAmount: DecimalUint,
  // Offsets carried between epochs (verifier adjustments). Optional so artifacts
  // produced before the ledger existed still parse.
  penaltyAppliedAmount: DecimalUint.optional(),
  creditAppliedAmount: DecimalUint.optional(),
  carriedAdjustments: z.array(z.object({
    operatorIdHash: Hex32,
    kind: z.enum(['penalty', 'credit']),
    amount: DecimalUint,
    reason: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
    sourceEpoch: z.number().int().nonnegative(),
    referenceHash: Hex32,
  }).strict()).optional(),
  allocations: z.array(z.object({
    operatorIdHash: Hex32,
    nodeId: Hex32,
    score: DecimalUint,
    rewardAmount: DecimalUint,
  }).strict()),
  rewardRoot: Hex32.nullable(),
  receiptBatchRoot: Hex32.nullable(),
  includedTaskCount: z.number().int().nonnegative(),
  excludedTasks: z.array(z.object({ taskId: Hex32, reasons: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/)) }).strict()),
  claims: z.array(z.object({
    leaf: z.object({
      epoch: z.number().int().nonnegative(),
      operatorIdHash: Hex32,
      nodeId: Hex32,
      score: DecimalUint,
      rewardAmount: DecimalUint,
      receiptBatchRoot: Hex32,
      policyVersion: z.string().min(1).max(64),
      claimNonce: Hex32,
    }).strict(),
    leafHash: Hex32,
    proof: z.array(Hex32).max(64),
  }).strict()),
  canonicalArtifact: z.string().min(2),
  artifactSha256: Hex32,
}).strict();

const GovernanceItemSchema = z.object({
  queueId: z.string().min(1).max(128),
  kind: z.enum(['safe', 'timelock']),
  target: Address,
  operationHash: Hex32,
  status: z.enum(['awaiting_signatures', 'scheduled', 'ready', 'executed', 'cancelled']),
  approvals: z.number().int().nonnegative(),
  approvalsRequired: z.number().int().positive(),
  executableAt: z.number().int().nonnegative().nullable(),
}).strict();

const AuditSchema = z.object({
  auditId: z.string().min(1).max(128),
  actor: Hex32,
  action: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  target: z.union([Hex32, Address, z.string().regex(/^[A-Z][A-Z0-9_:-]{0,127}$/)]),
  policyVersion: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  timestamp: z.number().int().nonnegative(),
  transactionHash: Hex32.nullable(),
  result: z.enum(['pending', 'confirmed', 'failed', 'rejected']),
}).strict();

const RootProposalTransactionSchema = z.object({
  to: Address,
  data: HexData,
  value: z.literal('0'),
  artifactSha256: Hex32,
  policyVersionHash: Hex32,
}).strict();

const ErrorSchema = z.object({ error: z.string() }).passthrough();
export type AdminIdentity = z.infer<typeof IdentitySchema>;
export type AdminSession = z.infer<typeof SessionSchema>;
export type AdminNode = z.infer<typeof NodeSchema>;
export type AdminDispute = z.infer<typeof DisputeSchema>;
export type AdminSettlement = z.infer<typeof SettlementSchema>;
export type GovernanceItem = z.infer<typeof GovernanceItemSchema>;
export type AuditItem = z.infer<typeof AuditSchema>;
export type RootProposalTransaction = z.infer<typeof RootProposalTransactionSchema>;

export function parseAdminSettlement(value: unknown): AdminSettlement {
  return SettlementSchema.parse(value);
}

export function parseAuditItems(value: unknown): AuditItem[] {
  return z.array(AuditSchema).parse(value);
}

export class AdminApiError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}

export function readSession(): AdminSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = SessionSchema.parse(JSON.parse(raw));
    if (session.expiresAt <= Math.floor(Date.now() / 1_000) + 5) throw new Error('expired');
    return session;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearSession(): void { sessionStorage.removeItem(SESSION_KEY); }

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  if (init.body) headers.set('content-type', 'application/json');
  const response = await fetch(path.startsWith('/api/me') ? path : `${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
  const payload: unknown = await response.json().catch(() => ({ error: 'INVALID_RESPONSE' }));
  if (!response.ok) {
    const parsed = ErrorSchema.safeParse(payload);
    throw new AdminApiError(parsed.success ? parsed.data.error : 'INVALID_RESPONSE', response.status);
  }
  return payload;
}

async function authed(path: string, init: RequestInit = {}): Promise<unknown> {
  const session = readSession();
  if (!session) throw new AdminApiError('SESSION_EXPIRED', 401);
  const headers = new Headers(init.headers);
  headers.set('x-csrf-token', session.csrfToken);
  try { return await request(path, { ...init, headers }); }
  catch (error) {
    if (error instanceof AdminApiError && error.status === 401) clearSession();
    throw error;
  }
}

export async function loadIdentity(): Promise<AdminIdentity> {
  return IdentitySchema.parse(await request('/api/me', { method: 'GET', cache: 'no-store' }));
}

export async function requestSiweChallenge(input: { domain: string; uri: string; chainId: number }) {
  return z.object({ nonce: z.string().min(8), expiresAt: z.number().int().positive() }).passthrough().parse(await request('/v1/auth/siwe/challenge', {
    method: 'POST', body: JSON.stringify(input),
  }));
}

export async function authenticateSiwe(message: string, signature: string, wallet: string): Promise<AdminSession> {
  const partial = z.object({ actorIdHash: Hex32, csrfToken: z.string().min(16), expiresAt: z.number().int().positive() }).strict()
    .parse(await request('/v1/auth/siwe', { method: 'POST', body: JSON.stringify({ message, signature }) }));
  const session = SessionSchema.parse({ ...partial, wallet });
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function listAdminNodes(): Promise<AdminNode[]> {
  return z.array(NodeSchema).parse(await authed('/v1/admin/nodes'));
}
export async function listDisputes(): Promise<AdminDispute[]> {
  return z.array(DisputeSchema).parse(await authed('/v1/admin/disputes'));
}
export async function resolveDispute(taskId: string, resolution: 'upheld' | 'rejected', note: string): Promise<AdminDispute> {
  return DisputeSchema.parse(await authed(`/v1/admin/disputes/${Hex32.parse(taskId)}/resolve`, { method: 'POST', body: JSON.stringify({ resolution, note }) }));
}
export async function loadSettlement(): Promise<AdminSettlement> {
  return parseAdminSettlement(await authed('/v1/admin/settlements/current'));
}
export async function prepareSettlementProposal(input: { approvedBy: string; approvedAt: number; artifactSha256: string; signature: string }): Promise<RootProposalTransaction> {
  return RootProposalTransactionSchema.parse(await authed('/v1/admin/settlements/current/proposal', { method: 'POST', body: JSON.stringify(input) }));
}
export async function listGovernanceQueue(): Promise<GovernanceItem[]> {
  return z.array(GovernanceItemSchema).parse(await authed('/v1/admin/governance/queue'));
}
export async function listAudit(): Promise<AuditItem[]> {
  return parseAuditItems(await authed('/v1/admin/audit'));
}
export async function appendTransactionAudit(input: { action: 'NODE_APPROVED' | 'NODE_SUSPENDED' | 'NODE_REJECTED' | 'NODE_TRUST_LEVEL_CHANGED'; target: string; policyVersion: string; transactionHash: string | null; result: 'pending' | 'confirmed' | 'failed' }): Promise<void> {
  await authed('/v1/admin/audit', { method: 'POST', body: JSON.stringify(input) });
}
