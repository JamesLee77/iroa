import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AdminSettlement } from './api';
import { verifySettlementArtifact } from './settlement-integrity';

const HEX = `0x${'11'.repeat(32)}` as const;

describe('settlement artifact integrity', () => {
  it('rejects an envelope whose claim data differs from the hashed canonical artifact', async () => {
    const artifact = {
      allocations: [{ operatorIdHash: HEX, nodeId: HEX, score: '100', rewardAmount: '1000' }],
      capExcludedAmount: '0',
      claims: [{ leaf: { epoch: 1, operatorIdHash: HEX, nodeId: HEX, score: '100', rewardAmount: '1000', receiptBatchRoot: HEX, policyVersion: '1.0.0', claimNonce: HEX }, leafHash: HEX, proof: [HEX] }],
      epoch: 1,
      excludedTasks: [],
      includedTaskCount: 1,
      monthlyBudget: '2000',
      policyVersion: '1.0.0',
      receiptBatchRoot: HEX,
      rewardRoot: HEX,
      roundingExcludedAmount: '0',
      totalReward: '1000',
      totalValidScore: '100',
      unusedAmount: '1000',
    };
    const canonicalArtifact = JSON.stringify(artifact);
    const settlement = {
      ...artifact,
      claims: [{ ...artifact.claims[0]!, leafHash: `0x${'22'.repeat(32)}` }],
      canonicalArtifact,
      artifactSha256: `0x${createHash('sha256').update(canonicalArtifact).digest('hex')}`,
    } as AdminSettlement;
    await expect(verifySettlementArtifact(settlement)).rejects.toThrow('SETTLEMENT_ARTIFACT_CONTENT_MISMATCH');
  });
});
