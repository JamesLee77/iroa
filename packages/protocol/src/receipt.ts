import { z } from 'zod';
import {
  AddressSchema,
  ChainIdSchema,
  Hex32Schema,
  PolicyVersionSchema,
  SignatureSchema,
  UnixSecondsSchema,
} from './policy.js';

const ReceiptContextSchema = z.object({
  chainId: ChainIdSchema,
  verifyingContract: AddressSchema,
  policyVersion: PolicyVersionSchema,
  nonce: Hex32Schema,
});

export const ResultReceiptSchema = ReceiptContextSchema.extend({
  taskId: Hex32Schema,
  nodeId: Hex32Schema,
  operatorIdHash: Hex32Schema,
  startedAt: UnixSecondsSchema,
  completedAt: UnixSecondsSchema,
  resultHash: Hex32Schema,
  outcomeCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  accessibilityMetricsHash: Hex32Schema,
  nodeSignature: SignatureSchema,
}).strict().refine((receipt) => receipt.completedAt >= receipt.startedAt, {
  message: 'completedAt must be greater than or equal to startedAt',
  path: ['completedAt'],
});

export const DeletionMethodSchema = z.enum([
  'ephemeral-volume-destroyed',
  'cryptographic-erasure',
  'secure-delete',
]);

export const DeletionReceiptSchema = ReceiptContextSchema.extend({
  taskId: Hex32Schema,
  nodeId: Hex32Schema,
  deletedAt: UnixSecondsSchema,
  storageScopeHash: Hex32Schema,
  runtimeImageHash: Hex32Schema,
  deletionMethod: DeletionMethodSchema,
  nodeSignature: SignatureSchema,
}).strict();

export type ResultReceipt = z.infer<typeof ResultReceiptSchema>;
export type DeletionMethod = z.infer<typeof DeletionMethodSchema>;
export type DeletionReceipt = z.infer<typeof DeletionReceiptSchema>;
