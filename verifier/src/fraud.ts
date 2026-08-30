import { Hex32Schema, PolicyVersionSchema, type Hex32 } from '@iroa/protocol';
import { z } from 'zod';

export const FraudExclusionCodeSchema = z.enum([
  'SELF_DEALING',
  'DUPLICATE_TASK',
  'COMPLETION_UNCONFIRMED',
  'POLICY_DRIFT',
  'RECEIPT_INVALID',
  'DELETION_UNVERIFIED',
]);

export type FraudExclusionCode = z.infer<typeof FraudExclusionCodeSchema>;

export const FraudFactsSchema = z.object({
  requesterIdHash: Hex32Schema,
  operatorIdHash: Hex32Schema,
  taskFingerprint: Hex32Schema,
  completionEvidenceHash: Hex32Schema,
  userConfirmed: z.boolean(),
  declaredPolicyVersion: PolicyVersionSchema,
  verifiedPolicyVersion: PolicyVersionSchema,
  receiptPairVerified: z.boolean(),
  deletionVerified: z.boolean(),
}).strict();

export type FraudFacts = z.infer<typeof FraudFactsSchema>;

const ZERO_HASH = `0x${'00'.repeat(32)}` as Hex32;

export function evaluateFraud(
  factsValue: FraudFacts,
  duplicateFingerprints: ReadonlySet<Hex32> = new Set(),
): FraudExclusionCode[] {
  const facts = FraudFactsSchema.parse(factsValue);
  const reasons: FraudExclusionCode[] = [];
  if (facts.requesterIdHash === facts.operatorIdHash) reasons.push('SELF_DEALING');
  if (duplicateFingerprints.has(facts.taskFingerprint)) reasons.push('DUPLICATE_TASK');
  if (!facts.userConfirmed || facts.completionEvidenceHash === ZERO_HASH) reasons.push('COMPLETION_UNCONFIRMED');
  if (facts.declaredPolicyVersion !== facts.verifiedPolicyVersion) reasons.push('POLICY_DRIFT');
  if (!facts.receiptPairVerified) reasons.push('RECEIPT_INVALID');
  if (!facts.deletionVerified) reasons.push('DELETION_UNVERIFIED');
  return reasons;
}

export function duplicateTaskFingerprints(values: readonly FraudFacts[]): ReadonlySet<Hex32> {
  const counts = new Map<Hex32, number>();
  for (const value of values) {
    const fingerprint = FraudFactsSchema.parse(value).taskFingerprint;
    counts.set(fingerprint, (counts.get(fingerprint) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([fingerprint]) => fingerprint));
}
