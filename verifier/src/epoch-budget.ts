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

/**
 * Why an operator's reward is adjusted in a later epoch. Rewards already claimed
 * cannot be pulled back from a wallet, so a confirmed fault is settled by
 * withholding from what the operator earns next (whitepaper §16.4 "환수"), and an
 * underpayment upheld after the challenge window is repaid the same way.
 */
export const AdjustmentReasonSchema = z.enum([
  'FRAUD_CONFIRMED',
  'SECURITY_VIOLATION',
  'PRIVACY_VIOLATION',
  'OVERPAYMENT_CORRECTION',
  'DISPUTE_UPHELD_AFTER_WINDOW',
  'UNDERPAYMENT_CORRECTION',
]);

export const OperatorAdjustmentSchema = z.object({
  operatorIdHash: Hex32Schema,
  /** `penalty` withholds from the operator; `credit` pays the operator more. */
  kind: z.enum(['penalty', 'credit']),
  amount: DecimalUintSchema,
  reason: AdjustmentReasonSchema,
  /** Epoch whose settlement the adjustment corrects. */
  sourceEpoch: z.number().int().nonnegative(),
  /** Hash of the finding, dispute, or correction record that authorises it. */
  referenceHash: Hex32Schema,
}).strict().refine((adjustment) => BigInt(adjustment.amount) > 0n, { message: 'ADJUSTMENT_AMOUNT_ZERO', path: ['amount'] });

export type OperatorAdjustment = z.infer<typeof OperatorAdjustmentSchema>;

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
  /** Withheld this epoch under penalties; it stays in the vault. */
  readonly penaltyAppliedAmount: string;
  /** Paid this epoch under credits, inside the operator cap. */
  readonly creditAppliedAmount: string;
  /** Adjustments not settled in full this epoch, with their unpaid remainder, for the next one. */
  readonly carriedAdjustments: readonly OperatorAdjustment[];
  readonly allocations: readonly NodeRewardAllocation[];
}

function checkedUint256(value: bigint, code: string): bigint {
  if (value < 0n || value > UINT256_MAX) throw new Error(code);
  return value;
}

/** Oldest source epoch first, then by reference, so the same ledger always settles the same way. */
function byProvenance(left: OperatorAdjustment, right: OperatorAdjustment): number {
  return left.sourceEpoch - right.sourceEpoch || left.referenceHash.localeCompare(right.referenceHash);
}

/**
 * Consumes `available` from the given adjustments in provenance order, returning what
 * was consumed and the adjustments that still carry an unpaid remainder.
 */
function consume(adjustments: readonly OperatorAdjustment[], available: bigint): { consumed: bigint; carried: OperatorAdjustment[] } {
  let remaining = available;
  let consumed = 0n;
  const carried: OperatorAdjustment[] = [];
  for (const adjustment of [...adjustments].sort(byProvenance)) {
    const amount = BigInt(adjustment.amount);
    const taken = amount < remaining ? amount : remaining;
    remaining -= taken;
    consumed += taken;
    if (taken < amount) carried.push({ ...adjustment, amount: (amount - taken).toString(10) });
  }
  return { consumed, carried };
}

export function settleEpochBudget(input: {
  readonly monthlyBudget: string;
  readonly nodes: readonly NodeScoreAllocation[];
  readonly adjustments?: readonly OperatorAdjustment[];
}): EpochBudgetSettlement {
  const monthlyBudget = checkedUint256(BigInt(DecimalUintSchema.parse(input.monthlyBudget)), 'BUDGET_UINT256_OVERFLOW');
  const nodes = input.nodes.map((node) => NodeScoreAllocationSchema.parse(node));
  const adjustments = (input.adjustments ?? []).map((adjustment) => OperatorAdjustmentSchema.parse(adjustment));
  const adjustmentsByOperator = new Map<Hex32, OperatorAdjustment[]>();
  for (const adjustment of adjustments) {
    const current = adjustmentsByOperator.get(adjustment.operatorIdHash) ?? [];
    current.push(adjustment);
    adjustmentsByOperator.set(adjustment.operatorIdHash, current);
  }
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
    // Nothing is paid, so nothing can be withheld or credited: every adjustment carries.
    return {
      monthlyBudget: monthlyBudget.toString(10),
      totalValidScore: totalValidScore.toString(10),
      totalReward: '0',
      capExcludedAmount: '0',
      roundingExcludedAmount: '0',
      unusedAmount: monthlyBudget.toString(10),
      penaltyAppliedAmount: '0',
      creditAppliedAmount: '0',
      carriedAdjustments: [...adjustments].sort(byProvenance),
      allocations: [],
    };
  }

  const operatorCap = (monthlyBudget * MAX_OPERATOR_REWARD_BPS) / BASIS_POINTS;
  const allocations: NodeRewardAllocation[] = [];
  let capExcludedAmount = 0n;
  let roundingExcludedAmount = 0n;
  let penaltyAppliedAmount = 0n;
  let creditAppliedAmount = 0n;
  const carriedAdjustments: OperatorAdjustment[] = [];

  const operators = [...operatorNodes.entries()].sort(([left], [right]) => left.localeCompare(right));
  for (const [operatorIdHash, operatorEntries] of operators) {
    const operatorScore = operatorEntries.reduce((total, entry) => total + BigInt(entry.score), 0n);
    const proportionalReward = (monthlyBudget * operatorScore) / totalValidScore;
    const ledger = adjustmentsByOperator.get(operatorIdHash) ?? [];
    adjustmentsByOperator.delete(operatorIdHash);

    // A credit is paid from the same budget and never lifts the operator above the cap.
    const credits = consume(ledger.filter((adjustment) => adjustment.kind === 'credit'), operatorCap > proportionalReward ? operatorCap - proportionalReward : 0n);
    creditAppliedAmount += credits.consumed;
    carriedAdjustments.push(...credits.carried);

    const earned = proportionalReward + credits.consumed;
    const cappedReward = earned < operatorCap ? earned : operatorCap;
    capExcludedAmount += earned - cappedReward;

    // A penalty is withheld from this epoch's reward and never goes below zero; the
    // remainder waits for the next epoch. What is withheld stays in the vault.
    const penalties = consume(ledger.filter((adjustment) => adjustment.kind === 'penalty'), cappedReward);
    penaltyAppliedAmount += penalties.consumed;
    carriedAdjustments.push(...penalties.carried);
    const operatorReward = cappedReward - penalties.consumed;
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

  // Operators with a ledger but no valid work this epoch carry everything.
  for (const ledger of adjustmentsByOperator.values()) carriedAdjustments.push(...ledger);

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
    penaltyAppliedAmount: penaltyAppliedAmount.toString(10),
    creditAppliedAmount: creditAppliedAmount.toString(10),
    carriedAdjustments: carriedAdjustments.sort((left, right) => left.operatorIdHash.localeCompare(right.operatorIdHash) || byProvenance(left, right)),
    allocations,
  };
}
