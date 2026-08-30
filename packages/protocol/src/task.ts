import { z } from 'zod';
import { Hex32Schema, PolicyVersionSchema, UnixSecondsSchema } from './policy.js';

export const TaskStateSchema = z.enum([
  'draft',
  'awaiting_approval',
  'queued',
  'assigned',
  'running',
  'awaiting_confirmation',
  'verified',
  'disputed',
  'failed',
  'cancelled',
  'reward_pending',
  'rewarded',
]);

export type TaskState = z.infer<typeof TaskStateSchema>;

const TASK_TRANSITIONS = {
  draft: ['awaiting_approval', 'cancelled'],
  awaiting_approval: ['queued', 'cancelled'],
  queued: ['assigned', 'cancelled'],
  assigned: ['queued', 'running', 'failed', 'cancelled'],
  running: ['awaiting_confirmation', 'failed', 'cancelled'],
  awaiting_confirmation: ['verified', 'disputed', 'failed', 'cancelled'],
  verified: ['reward_pending'],
  disputed: ['verified', 'failed', 'cancelled'],
  failed: ['queued', 'cancelled'],
  cancelled: [],
  reward_pending: ['rewarded', 'disputed'],
  rewarded: [],
} as const satisfies Record<TaskState, readonly TaskState[]>;

export function canTransition(from: TaskState, to: TaskState): boolean {
  return (TASK_TRANSITIONS[from] as readonly TaskState[]).includes(to);
}

export const TaskTrustLevelSchema = z.enum(['N0', 'N1', 'N2', 'N3', 'N4']);

const CiphertextReferenceSchema = z
  .string()
  .max(2_048)
  .regex(/^iroa-blob:\/\/[A-Za-z0-9][A-Za-z0-9._~:/-]*$/, 'Expected an opaque iroa-blob reference');

const ResultSchemaReferenceSchema = z
  .string()
  .max(2_048)
  .regex(/^iroa-schema:\/\/[A-Za-z0-9][A-Za-z0-9._~:/-]*$/, 'Expected an iroa-schema reference');

export const TaskCapsuleSchema = z.object({
  taskId: Hex32Schema,
  policyVersion: PolicyVersionSchema,
  trustLevel: TaskTrustLevelSchema,
  capabilityScope: z.array(z.string().trim().min(1).max(128)).min(1).max(32),
  expiresAt: UnixSecondsSchema,
  inputCiphertextRef: CiphertextReferenceSchema,
  expectedResultSchema: ResultSchemaReferenceSchema,
  userApprovalHash: Hex32Schema,
}).strict();

export type TaskTrustLevel = z.infer<typeof TaskTrustLevelSchema>;
export type TaskCapsule = z.infer<typeof TaskCapsuleSchema>;
