import { DecimalUintSchema, Hex32Schema, type Hex32 } from '@iroa/protocol';
import { z } from 'zod';

const BASIS_POINTS = 10_000n;
const MAX_OPERATOR_REWARD_BPS = 500n;
const UINT256_MAX = (1n << 256n) - 1n;

export const NodeScoreAllocationSchema = z.object({
  operatorIdHash: Hex32Schema,
  nodeId: Hex32Schema,
  score: DecimalUintSchema,
}).strict();

export type NodeScoreAllocation = z.infer<typeof NodeScoreAllocationSchema>;

export interface NodeRewardAllocation extends NodeScoreAllocation {
  readonly rewardAmount: string;
}

export interface EpochBudgetSettlement {
  readonly monthlyBudget: string;
  readonly totalValidScore: string;
  readonly totalReward: string;
  readonly capExcludedAmount: string;
  readonly roundingExcludedAmount: string;
  readonly unusedAmount: string;
  readonly allocations: readonly NodeRewardAllocation[];
}

function checkedUint256(value: bigint, code: string): bigint {
  if (value < 0n || value > UINT256_MAX) throw new Error(code);
  return value;
}

export function settleEpochBudget(input: {
  readonly monthlyBudget: string;
  readonly nodes: readonly NodeScoreAllocation[];
}): EpochBudgetSettlement {
  const monthlyBudget = checkedUint256(BigInt(DecimalUintSchema.parse(input.monthlyBudget)), 'BUDGET_UINT256_OVERFLOW');
  const nodes = input.nodes.map((node) => NodeScoreAllocationSchema.parse(node));
  const nodeIds = new Set<Hex32>();
  const operatorNodes = new Map<Hex32, NodeScoreAllocation[]>();
  let totalValidScore = 0n;
  for (const node of nodes) {
    if (nodeIds.has(node.nodeId)) throw new Error('DUPLICATE_NODE_ALLOCATION');
    nodeIds.add(node.nodeId);
    const score = checkedUint256(BigInt(node.score), 'SCORE_UINT256_OVERFLOW');
    if (score === 0n) continue;
    totalValidScore = checkedUint256(totalValidScore + score, 'TOTAL_SCORE_UINT256_OVERFLOW');
    const current = operatorNodes.get(node.operatorIdHash) ?? [];
    current.push(node);
    operatorNodes.set(node.operatorIdHash, current);
  }

  if (monthlyBudget === 0n || totalValidScore === 0n) {
    return {
      monthlyBudget: monthlyBudget.toString(10),
      totalValidScore: totalValidScore.toString(10),
      totalReward: '0',
      capExcludedAmount: '0',
      roundingExcludedAmount: '0',
      unusedAmount: monthlyBudget.toString(10),
      allocations: [],
    };
  }

  const operatorCap = (monthlyBudget * MAX_OPERATOR_REWARD_BPS) / BASIS_POINTS;
  const allocations: NodeRewardAllocation[] = [];
  let capExcludedAmount = 0n;
  let roundingExcludedAmount = 0n;

  const operators = [...operatorNodes.entries()].sort(([left], [right]) => left.localeCompare(right));
  for (const [operatorIdHash, operatorEntries] of operators) {
    const operatorScore = operatorEntries.reduce((total, entry) => total + BigInt(entry.score), 0n);
    const proportionalReward = (monthlyBudget * operatorScore) / totalValidScore;
    const operatorReward = proportionalReward < operatorCap ? proportionalReward : operatorCap;
    capExcludedAmount += proportionalReward - operatorReward;
    let allocatedToNodes = 0n;
    const sortedNodes = [...operatorEntries].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    for (const node of sortedNodes) {
      const rewardAmount = (operatorReward * BigInt(node.score)) / operatorScore;
      if (rewardAmount === 0n) continue;
      allocatedToNodes += rewardAmount;
      allocations.push({ operatorIdHash, nodeId: node.nodeId, score: node.score, rewardAmount: rewardAmount.toString(10) });
    }
    roundingExcludedAmount += operatorReward - allocatedToNodes;
  }

  allocations.sort((left, right) => (
    left.operatorIdHash.localeCompare(right.operatorIdHash) || left.nodeId.localeCompare(right.nodeId)
  ));
  const totalReward = allocations.reduce((total, allocation) => total + BigInt(allocation.rewardAmount), 0n);
  return {
    monthlyBudget: monthlyBudget.toString(10),
    totalValidScore: totalValidScore.toString(10),
    totalReward: totalReward.toString(10),
    capExcludedAmount: capExcludedAmount.toString(10),
    roundingExcludedAmount: roundingExcludedAmount.toString(10),
    unusedAmount: (monthlyBudget - totalReward).toString(10),
    allocations,
  };
}
