import { describe, expect, it } from 'vitest';
import { parseAdminSettlement, parseAuditItems } from './api';

const HEX = `0x${'11'.repeat(32)}`;

describe('admin settlement boundary', () => {
  it('accepts the verifier RewardSettlement envelope without renaming budget fields', () => {
    const artifact = {
      epoch: 1,
      policyVersion: '1.0.0',
      monthlyBudget: '2000',
      totalValidScore: '100',
      totalReward: '1000',
      capExcludedAmount: '0',
      roundingExcludedAmount: '0',
      unusedAmount: '1000',
      allocations: [{ operatorIdHash: HEX, nodeId: HEX, score: '100', rewardAmount: '1000' }],
      rewardRoot: HEX,
      receiptBatchRoot: HEX,
      claims: [{
        leaf: { epoch: 1, operatorIdHash: HEX, nodeId: HEX, score: '100', rewardAmount: '1000', receiptBatchRoot: HEX, policyVersion: '1.0.0', claimNonce: HEX },
        leafHash: HEX,
        proof: [HEX],
      }],
      includedTaskCount: 1,
      excludedTasks: [],
    };
    expect(() => parseAdminSettlement({ ...artifact, canonicalArtifact: JSON.stringify(artifact), artifactSha256: HEX })).not.toThrow();
  });
});

describe('admin audit privacy boundary', () => {
  it('rejects an email actor before it can reach the audit table or CSV', () => {
    expect(() => parseAuditItems([{
      auditId: 'audit-1',
      actor: 'person@example.com',
      action: 'NODE_APPROVED',
      target: HEX,
      policyVersion: '1.0.0',
      timestamp: 1_800_000_000,
      transactionHash: HEX,
      result: 'confirmed',
    }])).toThrow();
  });
});
