import { describe, expect, it } from 'vitest';
import {
  DeletionReceiptSchema,
  ResultReceiptSchema,
  RewardLeafSchema,
  TaskCapsuleSchema,
  canTransition,
} from './index.js';

const hash = `0x${'ab'.repeat(32)}`;
const address = `0x${'12'.repeat(20)}`;
const signature = `0x${'34'.repeat(65)}`;

describe('IROA protocol contracts', () => {
  it('allows only the approved task lifecycle transitions', () => {
    expect(canTransition('draft', 'awaiting_approval')).toBe(true);
    expect(canTransition('assigned', 'queued')).toBe(true);
    expect(canTransition('disputed', 'verified')).toBe(true);
    expect(canTransition('failed', 'queued')).toBe(true);
    expect(canTransition('draft', 'running')).toBe(false);
    expect(canTransition('awaiting_approval', 'assigned')).toBe(false);
    expect(canTransition('cancelled', 'queued')).toBe(false);
    expect(canTransition('rewarded', 'disputed')).toBe(false);
  });

  it('accepts a bounded task capsule', () => {
    expect(
      TaskCapsuleSchema.parse({
        taskId: hash,
        policyVersion: '1.0.0',
        trustLevel: 'N2',
        capabilityScope: ['public-information'],
        expiresAt: 1_800_000_000,
        inputCiphertextRef: 'iroa-blob://task/example',
        expectedResultSchema: 'iroa-schema://public-information/v1',
        userApprovalHash: hash,
      }),
    ).toBeDefined();
  });

  it('rejects undeclared capsule fields', () => {
    expect(
      TaskCapsuleSchema.safeParse({
        taskId: hash,
        policyVersion: '1.0.0',
        trustLevel: 'N2',
        capabilityScope: ['public-information'],
        expiresAt: 1_800_000_000,
        inputCiphertextRef: 'iroa-blob://task/example',
        expectedResultSchema: 'iroa-schema://public-information/v1',
        userApprovalHash: hash,
        rawPersonalData: 'must never enter a Task Capsule',
      }).success,
    ).toBe(false);
  });

  it('rejects inline capsule payloads', () => {
    expect(
      TaskCapsuleSchema.safeParse({
        taskId: hash,
        policyVersion: '1.0.0',
        trustLevel: 'N2',
        capabilityScope: ['public-information'],
        expiresAt: 1_800_000_000,
        inputCiphertextRef: 'raw health and reservation details',
        expectedResultSchema: 'iroa-schema://public-information/v1',
        userApprovalHash: hash,
      }).success,
    ).toBe(false);
  });

  it('requires chain-bound signed result and deletion receipts', () => {
    const context = {
      chainId: 84532,
      verifyingContract: address,
      policyVersion: '1.0.0',
      nonce: hash,
      taskId: hash,
      nodeId: hash,
      nodeSignature: signature,
    } as const;

    expect(
      ResultReceiptSchema.parse({
        ...context,
        operatorIdHash: hash,
        startedAt: 1_800_000_000,
        completedAt: 1_800_000_001,
        resultHash: hash,
        outcomeCode: 'COMPLETED',
        accessibilityMetricsHash: hash,
      }),
    ).toBeDefined();

    expect(
      DeletionReceiptSchema.parse({
        ...context,
        deletedAt: 1_800_000_002,
        storageScopeHash: hash,
        runtimeImageHash: hash,
        deletionMethod: 'cryptographic-erasure',
      }),
    ).toBeDefined();
  });

  it('preserves uint256 reward scores without precision loss', () => {
    expect(
      RewardLeafSchema.safeParse({
        epoch: 1,
        operatorIdHash: hash,
        nodeId: hash,
        score: '9007199254740993',
        rewardAmount: '1000000000000000000',
        receiptBatchRoot: hash,
        policyVersion: '1.0.0',
        claimNonce: hash,
      }).success,
    ).toBe(true);
  });

  it('rejects malformed hashes, negative timestamps and lossy reward amounts', () => {
    expect(
      TaskCapsuleSchema.safeParse({
        taskId: '0x1234',
        policyVersion: '1.0.0',
        trustLevel: 'N2',
        capabilityScope: ['public-information'],
        expiresAt: -1,
        inputCiphertextRef: 'iroa-blob://task/example',
        expectedResultSchema: 'iroa-schema://public-information/v1',
        userApprovalHash: hash,
      }).success,
    ).toBe(false);

    expect(
      RewardLeafSchema.safeParse({
        epoch: 1,
        operatorIdHash: hash,
        nodeId: hash,
        score: '10000',
        rewardAmount: '01',
        receiptBatchRoot: hash,
        policyVersion: '1.0.0',
        claimNonce: hash,
      }).success,
    ).toBe(false);
  });
});
