import {
  Hex32Schema,
  TaskCapsuleSchema,
  TaskStateSchema,
  type Hex32,
  type TaskCapsule,
  type TaskState,
} from '@iroa/protocol';
import { z } from 'zod';
import { sandboxConfig } from './config';

const SESSION_KEY = 'iroa-sandbox-session-v1';

const SessionSchema = z.object({
  csrfToken: z.string().min(16),
  expiresAt: z.number().int().positive(),
}).strict();

const TaskRecordSchema = z.object({
  taskId: Hex32Schema,
  state: TaskStateSchema,
  policyVersion: z.string(),
  capsule: TaskCapsuleSchema,
  rowVersion: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
}).strict();

const ReceiptSignalSchema = z.object({
  status: z.enum(['verified', 'missing']),
  receiptHash: Hex32Schema.nullable(),
  createdAt: z.number().int().nonnegative().nullable(),
}).strict();

const TaskSnapshotSchema = z.object({
  task: TaskRecordSchema,
  receipts: z.object({ result: ReceiptSignalSchema, deletion: ReceiptSignalSchema }).strict(),
}).strict();

const ApiErrorSchema = z.object({ error: z.string() }).passthrough();

export type TaskRecord = z.infer<typeof TaskRecordSchema>;
export type TaskSnapshot = z.infer<typeof TaskSnapshotSchema>;
export type ReceiptSignal = z.infer<typeof ReceiptSignalSchema>;

export class SandboxApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

function readSession(): z.infer<typeof SessionSchema> | null {
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = SessionSchema.parse(JSON.parse(raw));
    if (session.expiresAt <= Math.floor(Date.now() / 1_000) + 5) return null;
    return session;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

async function issueSession(): Promise<z.infer<typeof SessionSchema>> {
  const response = await fetch(`${sandboxConfig.apiBaseUrl}/v1/auth/sandbox`, {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new SandboxApiError('SESSION_REQUIRED', response.status);
  const session = SessionSchema.parse(await response.json());
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

async function request(path: string, init: RequestInit, allowNewSession = false): Promise<unknown> {
  const session = readSession() ?? (allowNewSession ? await issueSession() : null);
  if (!session) throw new SandboxApiError('SESSION_EXPIRED', 401);
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  headers.set('x-csrf-token', session.csrfToken);
  if (init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${sandboxConfig.apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  const payload: unknown = await response.json().catch(() => ({ error: 'INVALID_RESPONSE' }));
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(payload);
    const code = parsed.success ? parsed.data.error : 'INVALID_RESPONSE';
    if (response.status === 401) window.sessionStorage.removeItem(SESSION_KEY);
    throw new SandboxApiError(code, response.status);
  }
  return payload;
}

export async function createAndApproveTask(capsule: TaskCapsule): Promise<TaskRecord> {
  const validCapsule = TaskCapsuleSchema.parse(capsule);
  const created = TaskRecordSchema.parse(await request('/v1/tasks', {
    method: 'POST',
    body: JSON.stringify(validCapsule),
  }, true));
  return TaskRecordSchema.parse(await request(`/v1/tasks/${created.taskId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approvalHash: validCapsule.userApprovalHash }),
  }));
}

export async function getTask(taskId: Hex32): Promise<TaskSnapshot> {
  return TaskSnapshotSchema.parse(await request(`/v1/tasks/${Hex32Schema.parse(taskId)}`, { method: 'GET' }));
}

export async function cancelTask(taskId: Hex32): Promise<TaskRecord> {
  return TaskRecordSchema.parse(await request(`/v1/tasks/${Hex32Schema.parse(taskId)}/cancel`, { method: 'POST' }));
}

export async function confirmTask(taskId: Hex32): Promise<TaskRecord> {
  return TaskRecordSchema.parse(await request(`/v1/tasks/${Hex32Schema.parse(taskId)}/confirm`, { method: 'POST' }));
}

export type DisputeReason = 'RESULT_INCORRECT' | 'RESULT_INCOMPLETE' | 'ACCESSIBILITY_ISSUE' | 'OTHER';

export async function disputeTask(taskId: Hex32, reasonCode: DisputeReason, evidenceHash?: Hex32): Promise<TaskRecord> {
  return TaskRecordSchema.parse(await request(`/v1/tasks/${Hex32Schema.parse(taskId)}/dispute`, {
    method: 'POST',
    body: JSON.stringify({ reasonCode, ...(evidenceHash ? { evidenceHash } : {}) }),
  }));
}

export function isTerminalState(state: TaskState): boolean {
  return ['cancelled', 'failed', 'rewarded', 'disputed'].includes(state);
}
