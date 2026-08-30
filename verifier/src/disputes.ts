import { Hex32Schema, UnixSecondsSchema } from '@iroa/protocol';
import { z } from 'zod';

export const DisputeRecordSchema = z.object({
  taskId: Hex32Schema,
  evidenceHash: Hex32Schema,
  status: z.enum(['open', 'upheld', 'rejected']),
  openedAt: UnixSecondsSchema,
  resolvedAt: UnixSecondsSchema.nullable(),
  reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
}).strict().superRefine((record, context) => {
  if (record.status === 'open' && record.resolvedAt !== null) {
    context.addIssue({ code: 'custom', message: 'OPEN_DISPUTE_CANNOT_BE_RESOLVED', path: ['resolvedAt'] });
  }
  if (record.status !== 'open' && (record.resolvedAt === null || record.resolvedAt < record.openedAt)) {
    context.addIssue({ code: 'custom', message: 'DISPUTE_RESOLUTION_TIME_INVALID', path: ['resolvedAt'] });
  }
});

export type DisputeRecord = z.infer<typeof DisputeRecordSchema>;

export type DisputeExclusionCode = 'DISPUTE_OPEN' | 'DISPUTE_UPHELD';

export function disputeExclusion(recordValue: DisputeRecord | null): DisputeExclusionCode | null {
  if (recordValue === null) return null;
  const record = DisputeRecordSchema.parse(recordValue);
  if (record.status === 'open') return 'DISPUTE_OPEN';
  if (record.status === 'upheld') return 'DISPUTE_UPHELD';
  return null;
}
