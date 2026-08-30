import { StandardMerkleTree } from '@openzeppelin/merkle-tree';
import { buildRewardTree, type RewardClaim } from '@iroa/crypto';
import {
  DecimalUintSchema,
  AddressSchema,
  Hex32Schema,
  PolicyVersionSchema,
  UnixSecondsSchema,
  type Hex32,
  type RewardLeaf,
} from '@iroa/protocol';
import { encodeAbiParameters, keccak256, parseAbiParameters } from 'viem';
import { z } from 'zod';
import { DisputeRecordSchema, disputeExclusion, type DisputeRecord } from './disputes.js';
import { settleEpochBudget, type EpochBudgetSettlement } from './epoch-budget.js';
import {
  FraudFactsSchema,
  duplicateTaskFingerprints,
  evaluateFraud,
  type FraudExclusionCode,
  type FraudFacts,
} from './fraud.js';

export const SettlementCandidateSchema = z.object({
  taskId: Hex32Schema,
  nodeId: Hex32Schema,
  operatorIdHash: Hex32Schema,
  operatorWallet: AddressSchema,
  receiptPairHash: Hex32Schema,
  score: DecimalUintSchema,
  fraudFacts: FraudFactsSchema,
  dispute: DisputeRecordSchema.nullable(),
}).strict();

export type SettlementCandidate = z.infer<typeof SettlementCandidateSchema>;

export type SettlementExclusionCode = FraudExclusionCode
  | 'DISPUTE_OPEN'
  | 'DISPUTE_UPHELD'
  | 'ZERO_SCORE'
  | 'DUPLICATE_RECEIPT'
  | 'NODE_OPERATOR_CONFLICT'
  | 'OPERATOR_CONTEXT_MISMATCH'
  | 'DISPUTE_TASK_MISMATCH'
  | 'OPERATOR_ID_CONFLICT';

export interface ExcludedSettlementTask {
  readonly taskId: Hex32;
  readonly reasons: readonly SettlementExclusionCode[];
}

export interface RewardSettlement extends EpochBudgetSettlement {
  readonly epoch: number;
  readonly policyVersion: string;
  readonly rewardRoot: Hex32 | null;
  readonly receiptBatchRoot: Hex32 | null;
  readonly claims: readonly RewardClaim[];
  readonly includedTaskCount: number;
  readonly excludedTasks: readonly ExcludedSettlementTask[];
}

const CLAIM_NONCE_ABI = parseAbiParameters(
  'uint64 epoch, bytes32 operatorIdHash, bytes32 nodeId, bytes32 receiptBatchRoot, string policyVersion',
);

function receiptBatchRoot(receiptPairHashes: readonly Hex32[]): Hex32 {
  const tree = StandardMerkleTree.of(receiptPairHashes.map((hash) => [hash]), ['bytes32']);
  return tree.root as Hex32;
}

function claimNonce(input: {
  epoch: number;
  operatorIdHash: Hex32;
  nodeId: Hex32;
  receiptBatchRoot: Hex32;
  policyVersion: string;
}): Hex32 {
  return keccak256(encodeAbiParameters(CLAIM_NONCE_ABI, [
    BigInt(input.epoch),
    input.operatorIdHash,
    input.nodeId,
    input.receiptBatchRoot,
    input.policyVersion,
  ])) as Hex32;
}

export function buildRoot(input: {
  readonly epoch: number;
  readonly policyVersion: string;
  readonly monthlyBudget: string;
  readonly candidates: readonly SettlementCandidate[];
}): RewardSettlement {
  const epoch = UnixSecondsSchema.parse(input.epoch);
  const policyVersion = PolicyVersionSchema.parse(input.policyVersion);
  const monthlyBudget = DecimalUintSchema.parse(input.monthlyBudget);
  const candidates = input.candidates.map((candidate) => SettlementCandidateSchema.parse(candidate))
    .sort((left, right) => left.taskId.localeCompare(right.taskId));
  const duplicateFingerprints = duplicateTaskFingerprints(candidates.map((candidate) => candidate.fraudFacts));
  const taskCounts = new Map<Hex32, number>();
  const receiptCounts = new Map<Hex32, number>();
  const operatorsByNode = new Map<Hex32, Set<Hex32>>();
  const operatorIdsByWallet = new Map<string, Set<Hex32>>();
  for (const candidate of candidates) {
    taskCounts.set(candidate.taskId, (taskCounts.get(candidate.taskId) ?? 0) + 1);
    receiptCounts.set(candidate.receiptPairHash, (receiptCounts.get(candidate.receiptPairHash) ?? 0) + 1);
    const operators = operatorsByNode.get(candidate.nodeId) ?? new Set<Hex32>();
    operators.add(candidate.operatorIdHash);
    operatorsByNode.set(candidate.nodeId, operators);
    const wallet = candidate.operatorWallet.toLowerCase();
    const walletOperatorIds = operatorIdsByWallet.get(wallet) ?? new Set<Hex32>();
    walletOperatorIds.add(candidate.operatorIdHash);
    operatorIdsByWallet.set(wallet, walletOperatorIds);
  }

  const included: SettlementCandidate[] = [];
  const excludedTasks: ExcludedSettlementTask[] = [];
  for (const candidate of candidates) {
    const reasons = new Set<SettlementExclusionCode>(evaluateFraud(candidate.fraudFacts, duplicateFingerprints));
    if ((taskCounts.get(candidate.taskId) ?? 0) > 1) reasons.add('DUPLICATE_TASK');
    if (candidate.fraudFacts.operatorIdHash !== candidate.operatorIdHash) {
      reasons.add('OPERATOR_CONTEXT_MISMATCH');
    }
    if (candidate.fraudFacts.verifiedPolicyVersion !== policyVersion) reasons.add('POLICY_DRIFT');
    if ((receiptCounts.get(candidate.receiptPairHash) ?? 0) > 1) reasons.add('DUPLICATE_RECEIPT');
    if ((operatorsByNode.get(candidate.nodeId)?.size ?? 0) > 1) reasons.add('NODE_OPERATOR_CONFLICT');
    if ((operatorIdsByWallet.get(candidate.operatorWallet.toLowerCase())?.size ?? 0) > 1) {
      reasons.add('OPERATOR_ID_CONFLICT');
    }
    if (BigInt(candidate.score) === 0n) reasons.add('ZERO_SCORE');
    if (candidate.dispute && candidate.dispute.taskId !== candidate.taskId) {
      reasons.add('DISPUTE_TASK_MISMATCH');
    } else {
      const disputeReason = disputeExclusion(candidate.dispute as DisputeRecord | null);
      if (disputeReason) reasons.add(disputeReason);
    }
    if (reasons.size > 0) {
      excludedTasks.push({ taskId: candidate.taskId, reasons: [...reasons].sort() });
    } else {
      included.push(candidate);
    }
  }

  if (included.length === 0) {
    const emptyBudget = settleEpochBudget({ monthlyBudget, nodes: [] });
    return {
      ...emptyBudget,
      epoch,
      policyVersion,
      rewardRoot: null,
      receiptBatchRoot: null,
      claims: [],
      includedTaskCount: 0,
      excludedTasks,
    };
  }

  const globalReceiptBatchRoot = receiptBatchRoot(included.map((candidate) => candidate.receiptPairHash));
  const scoresByNode = new Map<string, { operatorIdHash: Hex32; nodeId: Hex32; score: bigint }>();
  for (const candidate of included) {
    const key = `${candidate.operatorIdHash}:${candidate.nodeId}`;
    const current = scoresByNode.get(key) ?? {
      operatorIdHash: candidate.operatorIdHash,
      nodeId: candidate.nodeId,
      score: 0n,
    };
    current.score += BigInt(candidate.score);
    scoresByNode.set(key, current);
  }
  const budget = settleEpochBudget({
    monthlyBudget,
    nodes: [...scoresByNode.values()].map((entry) => ({
      operatorIdHash: entry.operatorIdHash,
      nodeId: entry.nodeId,
      score: entry.score.toString(10),
    })),
  });
  const leaves: RewardLeaf[] = budget.allocations.map((allocation) => ({
    epoch,
    operatorIdHash: allocation.operatorIdHash,
    nodeId: allocation.nodeId,
    score: allocation.score,
    rewardAmount: allocation.rewardAmount,
    receiptBatchRoot: globalReceiptBatchRoot,
    policyVersion,
    claimNonce: claimNonce({ epoch, ...allocation, receiptBatchRoot: globalReceiptBatchRoot, policyVersion }),
  }));
  const tree = leaves.length > 0 ? buildRewardTree(leaves) : null;
  return {
    ...budget,
    epoch,
    policyVersion,
    rewardRoot: tree?.root ?? null,
    receiptBatchRoot: globalReceiptBatchRoot,
    claims: tree?.claims ?? [],
    includedTaskCount: included.length,
    excludedTasks,
  };
}

export function settleEpoch(input: Parameters<typeof buildRoot>[0]): RewardSettlement {
  return buildRoot(input);
}
