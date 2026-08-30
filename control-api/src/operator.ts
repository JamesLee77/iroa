import type { Address, Hex32, RewardLeaf } from '@iroa/protocol';
import { AddressSchema, Hex32Schema, RewardLeafSchema } from '@iroa/protocol';
import { z } from 'zod';
import type { AuthenticatedActor } from './auth.js';
import type { NodeDeviceRecord, Storage, TaskRecord } from './storage.js';

const ScoreBreakdownSchema = z.object({
  validatedTasks: z.number().int().nonnegative(),
  resultQualityBps: z.number().int().min(0).max(10_000),
  accessibilityQualityBps: z.number().int().min(0).max(10_000),
  securityGate: z.boolean(),
}).strict();

const OperatorRewardRecordSchema = z.object({
  recordId: Hex32Schema,
  leaf: RewardLeafSchema.nullable(),
  proof: z.array(Hex32Schema).max(64),
  scoreBreakdown: ScoreBreakdownSchema,
  excludedReasons: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/)).max(32),
}).strict().superRefine((record, context) => {
  if (!record.leaf && record.excludedReasons.length === 0) {
    context.addIssue({ code: 'custom', path: ['excludedReasons'], message: 'An excluded reward requires a reason' });
  }
});

export type OperatorRewardRecord = z.infer<typeof OperatorRewardRecordSchema>;

export interface OperatorRewardProvider {
  listForOperator(operatorWallet: Address): Promise<readonly OperatorRewardRecord[]>;
}

export class EmptyOperatorRewardProvider implements OperatorRewardProvider {
  async listForOperator(_operatorWallet: Address): Promise<readonly OperatorRewardRecord[]> {
    return [];
  }
}

function assertOperator(actor: AuthenticatedActor): Address {
  if (actor.type !== 'operator') throw new Error('OPERATOR_AUTH_REQUIRED');
  return AddressSchema.parse(actor.id);
}

export class OperatorService {
  constructor(
    private readonly storage: Storage,
    private readonly rewards: OperatorRewardProvider,
  ) {}

  async listNodes(actor: AuthenticatedActor): Promise<readonly NodeDeviceRecord[]> {
    const operatorWallet = assertOperator(actor).toLowerCase();
    return this.storage.transaction((transaction) => transaction.listNodes()
      .filter((node) => node.operatorAddress.toLowerCase() === operatorWallet)
      .sort((left, right) => left.createdAt - right.createdAt));
  }

  async listTasks(actor: AuthenticatedActor): Promise<readonly TaskRecord[]> {
    const operatorWallet = assertOperator(actor).toLowerCase();
    return this.storage.transaction((transaction) => {
      const ownedNodeIds = new Set<Hex32>(transaction.listNodes()
        .filter((node) => node.operatorAddress.toLowerCase() === operatorWallet)
        .map((node) => node.nodeId));
      return transaction.listTasks()
        .filter((task) => task.assignedNodeId && ownedNodeIds.has(task.assignedNodeId))
        .sort((left, right) => right.updatedAt - left.updatedAt);
    });
  }

  async listRewards(actor: AuthenticatedActor): Promise<readonly OperatorRewardRecord[]> {
    const operatorWallet = assertOperator(actor);
    const records = await this.rewards.listForOperator(operatorWallet);
    return records.map((record) => {
      const parsed = OperatorRewardRecordSchema.parse(record);
      if (parsed.leaf && parsed.leaf.operatorIdHash.toLowerCase() !== actor.idHash.toLowerCase()) {
        throw new Error('REWARD_OPERATOR_MISMATCH');
      }
      return parsed;
    });
  }
}

export type { RewardLeaf };
