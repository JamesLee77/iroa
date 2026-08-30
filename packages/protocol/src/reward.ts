import { z } from 'zod';
import {
  DecimalUintSchema,
  Hex32Schema,
  PolicyVersionSchema,
  UnixSecondsSchema,
} from './policy.js';

export const RewardLeafSchema = z.object({
  epoch: UnixSecondsSchema,
  operatorIdHash: Hex32Schema,
  nodeId: Hex32Schema,
  score: z.number().int().nonnegative().safe(),
  rewardAmount: DecimalUintSchema,
  receiptBatchRoot: Hex32Schema,
  policyVersion: PolicyVersionSchema,
  claimNonce: Hex32Schema,
});

export type RewardLeaf = z.infer<typeof RewardLeafSchema>;
