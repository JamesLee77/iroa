import { DecimalUintSchema } from '@iroa/protocol';
import { z } from 'zod';

const BASIS_POINTS = 10_000n;
const UINT256_MAX = (1n << 256n) - 1n;

const QualityBasisPointsSchema = z.number().int().min(0).max(10_000);

export const TaskScoreInputSchema = z.object({
  baseWorkUnit: DecimalUintSchema,
  completionGate: z.boolean(),
  securityGate: z.boolean(),
  resultQualityBps: QualityBasisPointsSchema,
  accessibilityQualityBps: QualityBasisPointsSchema,
  timelinessBps: QualityBasisPointsSchema,
  humanHandoffQualityBps: QualityBasisPointsSchema,
  resourceEfficiencyBps: QualityBasisPointsSchema,
}).strict();

export type TaskScoreInput = z.input<typeof TaskScoreInputSchema>;

export interface TaskScore {
  readonly score: string;
  readonly weightedQualityBps: number;
  readonly completionGate: 0 | 1;
  readonly securityGate: 0 | 1;
}

function assertUint256(value: bigint): bigint {
  if (value < 0n || value > UINT256_MAX) throw new Error('SCORE_UINT256_OVERFLOW');
  return value;
}

export function scoreTask(inputValue: TaskScoreInput): TaskScore {
  const input = TaskScoreInputSchema.parse(inputValue);
  const baseWorkUnit = assertUint256(BigInt(input.baseWorkUnit));
  const completionGate = input.completionGate ? 1 : 0;
  const securityGate = input.securityGate ? 1 : 0;
  const weightedQualityNumerator = (
    BigInt(input.resultQualityBps) * 4_000n
    + BigInt(input.accessibilityQualityBps) * 2_500n
    + BigInt(input.timelinessBps) * 1_500n
    + BigInt(input.humanHandoffQualityBps) * 1_000n
    + BigInt(input.resourceEfficiencyBps) * 1_000n
  );
  const weightedQualityBps = Number(weightedQualityNumerator / BASIS_POINTS);
  const gatedScore = completionGate === 1 && securityGate === 1
    ? (baseWorkUnit * BigInt(weightedQualityBps)) / BASIS_POINTS
    : 0n;
  return {
    score: assertUint256(gatedScore).toString(10),
    weightedQualityBps,
    completionGate,
    securityGate,
  };
}

export function capUptimeBonus(input: {
  readonly validTaskScore: string;
  readonly requestedBonus: string;
  readonly validTaskCount: number;
}): string {
  const validTaskScore = BigInt(DecimalUintSchema.parse(input.validTaskScore));
  const requestedBonus = BigInt(DecimalUintSchema.parse(input.requestedBonus));
  if (!Number.isSafeInteger(input.validTaskCount) || input.validTaskCount <= 0 || validTaskScore === 0n) return '0';
  const maximum = validTaskScore / 10n;
  return (requestedBonus < maximum ? requestedBonus : maximum).toString(10);
}
