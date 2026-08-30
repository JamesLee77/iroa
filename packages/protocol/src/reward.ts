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
  score: DecimalUintSchema,
  rewardAmount: DecimalUintSchema,
  receiptBatchRoot: Hex32Schema,
  policyVersion: PolicyVersionSchema,
  claimNonce: Hex32Schema,
}).strict();

export type RewardLeaf = z.infer<typeof RewardLeafSchema>;
