import {
  deletionReceiptTypedData,
  resultReceiptTypedData,
  type ReceiptDomainInput,
} from '@iroa/crypto';
import type { Address, DeletionReceipt, Hex32, ResultReceipt } from '@iroa/protocol';
import { encodePacked, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import { buildRoot, type SettlementCandidate } from '../src/build-root.js';
import { sha256Hex } from '../src/canonical.js';
import { capUptimeBonus, scoreTask } from '../src/score.js';
import { settleEpochBudget } from '../src/epoch-budget.js';
import {
  prepareRootProposal,
  rootApprovalMessage,
  settlementArtifact,
  type SettlementArtifactStore,
} from '../src/publish-root.js';
import { verifyReceiptPair } from '../src/verify-receipt.js';

const PRIVATE_KEY = `0x${'11'.repeat(32)}` as const;
const DEVICE = privateKeyToAccount(PRIVATE_KEY);
const OPERATOR_WALLET = `0x${'34'.repeat(20)}` as const;
const DOMAIN: ReceiptDomainInput = {
  chainId: 31337,
  verifyingContract: `0x${'12'.repeat(20)}`,
  version: '1',
};

function hex(byte: string): Hex32 {
  return `0x${byte.repeat(64)}` as Hex32;
}

async function receiptPair(overrides: {
  resultTaskId?: Hex32;
  deletionTaskId?: Hex32;
  nodeStatus?: 'active' | 'suspended';
  accessibilityMetricsHash?: Hex32;
} = {}) {
  const resultUnsigned = {
    chainId: DOMAIN.chainId,
    verifyingContract: DOMAIN.verifyingContract,
    policyVersion: '1.0.0',
    nonce: hex('c'),
    taskId: overrides.resultTaskId ?? hex('a'),
    nodeId: hex('b'),
    operatorIdHash: sha256Hex(OPERATOR_WALLET),
    startedAt: 100,
    completedAt: 110,
    resultHash: hex('e'),
    outcomeCode: 'SYNTHETIC_SUCCESS',
    accessibilityMetricsHash: overrides.accessibilityMetricsHash ?? hex('f'),
  } as const;
  const deletionUnsigned = {
    chainId: DOMAIN.chainId,
    verifyingContract: DOMAIN.verifyingContract,
    policyVersion: '1.0.0',
    nonce: hex('c'),
    taskId: overrides.deletionTaskId ?? resultUnsigned.taskId,
    nodeId: hex('b'),
    deletedAt: 111,
    storageScopeHash: hex('1'),
    runtimeImageHash: hex('2'),
    deletionMethod: 'ephemeral-volume-destroyed',
  } as const;
  const result: ResultReceipt = {
    ...resultUnsigned,
    nodeSignature: await DEVICE.signTypedData(resultReceiptTypedData(DOMAIN, resultUnsigned)),
  };
  const deletion: DeletionReceipt = {
    ...deletionUnsigned,
    nodeSignature: await DEVICE.signTypedData(deletionReceiptTypedData(DOMAIN, deletionUnsigned)),
  };
  return {
    result,
    deletion,
    nodeSnapshot: {
      nodeId: result.nodeId,
      operatorIdHash: result.operatorIdHash,
      operatorWallet: OPERATOR_WALLET,
      deviceAddress: DEVICE.address,
      deviceKeyHash: keccak256(encodePacked(['address'], [DEVICE.address])),
      capturedAt: 120,
      intervals: [{ status: overrides.nodeStatus ?? 'active', startsAt: 90, endsAt: null }],
    },
  };
}

function candidate(index: number, overrides: Partial<SettlementCandidate> = {}): SettlementCandidate {
  const taskId = `0x${index.toString(16).padStart(64, '0')}` as Hex32;
  return {
    taskId,
    nodeId: `0x${(100 + index).toString(16).padStart(64, '0')}` as Hex32,
    operatorIdHash: `0x${(200 + index).toString(16).padStart(64, '0')}` as Hex32,
    operatorWallet: `0x${index.toString(16).padStart(40, '0')}` as Address,
    receiptPairHash: `0x${(300 + index).toString(16).padStart(64, '0')}` as Hex32,
    score: '100',
    fraudFacts: {
      requesterIdHash: `0x${(400 + index).toString(16).padStart(64, '0')}` as Hex32,
      operatorIdHash: `0x${(200 + index).toString(16).padStart(64, '0')}` as Hex32,
      taskFingerprint: `0x${(500 + index).toString(16).padStart(64, '0')}` as Hex32,
      completionEvidenceHash: `0x${(600 + index).toString(16).padStart(64, '0')}` as Hex32,
      userConfirmed: true,
      declaredPolicyVersion: '1.0.0',
      verifiedPolicyVersion: '1.0.0',
      receiptPairVerified: true,
      deletionVerified: true,
    },
    dispute: null,
    ...overrides,
  };
}

describe('receipt verification', () => {
  it('commits all signed receipt fields into the pair hash', async () => {
    const first = await receiptPair({ accessibilityMetricsHash: hex('f') });
    const second = await receiptPair({ accessibilityMetricsHash: hex('8') });
    const firstVerified = await verifyReceiptPair({
      ...first,
      expectedPolicyVersion: '1.0.0',
      domain: DOMAIN,
    });
    const secondVerified = await verifyReceiptPair({
      ...second,
      expectedPolicyVersion: '1.0.0',
      domain: DOMAIN,
    });
    expect(secondVerified.receiptPairHash).not.toBe(firstVerified.receiptPairHash);
  });

  it('rejects mismatched receipt pairs', async () => {
    const pair = await receiptPair({ deletionTaskId: hex('9') });
    await expect(verifyReceiptPair({
      ...pair,
      expectedPolicyVersion: '1.0.0',
      domain: DOMAIN,
    })).rejects.toThrow('RECEIPT_PAIR_TASKID_MISMATCH');
  });

  it('rejects a NODE that was inactive when work completed', async () => {
    const pair = await receiptPair({ nodeStatus: 'suspended' });
    await expect(verifyReceiptPair({
      ...pair,
      expectedPolicyVersion: '1.0.0',
      domain: DOMAIN,
    })).rejects.toThrow('NODE_INACTIVE_AT_COMPLETION');
  });
});

describe('integer scoring and epoch budget', () => {
  it('never pays uptime when there was no valid work', () => {
    expect(capUptimeBonus({ validTaskScore: '0', requestedBonus: '100', validTaskCount: 0 })).toBe('0');
  });

  it('rejects a score that exceeds uint256', () => {
    expect(() => scoreTask({
      baseWorkUnit: (1n << 256n).toString(10),
      completionGate: true,
      securityGate: true,
      resultQualityBps: 10_000,
      accessibilityQualityBps: 10_000,
      timelinessBps: 10_000,
      humanHandoffQualityBps: 10_000,
      resourceEfficiencyBps: 10_000,
    })).toThrow('SCORE_UINT256_OVERFLOW');
  });

  it('rejects an oversized base work unit even when a gate is closed', () => {
    expect(() => scoreTask({
      baseWorkUnit: (1n << 256n).toString(10),
      completionGate: false,
      securityGate: false,
      resultQualityBps: 0,
      accessibilityQualityBps: 0,
      timelinessBps: 0,
      humanHandoffQualityBps: 0,
      resourceEfficiencyBps: 0,
    })).toThrow('SCORE_UINT256_OVERFLOW');
  });

  it('caps each operator at 5 percent and leaves the remainder unused', () => {
    const settlement = settleEpochBudget({
      monthlyBudget: '10000',
      nodes: [
        { operatorIdHash: hex('1'), nodeId: hex('2'), score: '100' },
        { operatorIdHash: hex('3'), nodeId: hex('4'), score: '100' },
      ],
    });
    expect(settlement.allocations.map((allocation) => allocation.rewardAmount)).toEqual(['500', '500']);
    expect(settlement.totalReward).toBe('1000');
    expect(settlement.unusedAmount).toBe('9000');
  });
});

describe('deterministic settlement', () => {
  it('excludes duplicate task IDs even when fingerprints differ', () => {
    const first = candidate(1);
    const second = candidate(2, { taskId: first.taskId });
    const settlement = buildRoot({ epoch: 0, policyVersion: '1.0.0', monthlyBudget: '10000', candidates: [first, second] });
    expect(settlement.includedTaskCount).toBe(0);
    expect(settlement.excludedTasks.every((task) => task.reasons.includes('DUPLICATE_TASK'))).toBe(true);
  });

  it('rejects multiple operator identities controlled by the same wallet', () => {
    const sharedWallet = `0x${'34'.repeat(20)}` as const;
    const first = candidate(1, { operatorWallet: sharedWallet });
    const second = candidate(2, { operatorWallet: sharedWallet });
    const settlement = buildRoot({ epoch: 0, policyVersion: '1.0.0', monthlyBudget: '10000', candidates: [first, second] });
    expect(settlement.includedTaskCount).toBe(0);
    expect(settlement.excludedTasks.every((task) => task.reasons.includes('OPERATOR_ID_CONFLICT'))).toBe(true);
  });

  it('rejects fraud facts bound to a different operator', () => {
    const original = candidate(1);
    const forged = candidate(1, {
      operatorIdHash: original.fraudFacts.requesterIdHash,
    });
    const settlement = buildRoot({ epoch: 0, policyVersion: '1.0.0', monthlyBudget: '10000', candidates: [forged] });
    expect(settlement.includedTaskCount).toBe(0);
    expect(settlement.excludedTasks[0]?.reasons).toContain('OPERATOR_CONTEXT_MISMATCH');
  });

  it('rejects a dispute record bound to a different task', () => {
    const forged = candidate(1, {
      dispute: {
        taskId: `0x${'2'.padStart(64, '0')}`,
        evidenceHash: hex('7'),
        status: 'rejected',
        openedAt: 200,
        resolvedAt: 201,
        reasonCode: 'USER_DISPUTED',
      },
    });
    const settlement = buildRoot({ epoch: 0, policyVersion: '1.0.0', monthlyBudget: '10000', candidates: [forged] });
    expect(settlement.includedTaskCount).toBe(0);
    expect(settlement.excludedTasks[0]?.reasons).toContain('DISPUTE_TASK_MISMATCH');
  });

  it('excludes disputed work', () => {
    const disputed = candidate(1, {
      dispute: {
        taskId: `0x${'1'.padStart(64, '0')}`,
        evidenceHash: hex('7'),
        status: 'open',
        openedAt: 200,
        resolvedAt: null,
        reasonCode: 'USER_DISPUTED',
      },
    });
    const settlement = buildRoot({ epoch: 0, policyVersion: '1.0.0', monthlyBudget: '10000', candidates: [disputed] });
    expect(settlement.includedTaskCount).toBe(0);
    expect(settlement.excludedTasks[0]?.reasons).toContain('DISPUTE_OPEN');
  });

  it('produces the same roots regardless of candidate input order', () => {
    const first = candidate(1);
    const second = candidate(2);
    const forward = buildRoot({ epoch: 0, policyVersion: '1.0.0', monthlyBudget: '10000', candidates: [first, second] });
    const reverse = buildRoot({ epoch: 0, policyVersion: '1.0.0', monthlyBudget: '10000', candidates: [second, first] });
    expect(reverse.rewardRoot).toBe(forward.rewardRoot);
    expect(reverse.receiptBatchRoot).toBe(forward.receiptBatchRoot);
    expect(reverse.claims).toEqual(forward.claims);
  });
});

describe('root publication approval', () => {
  it('rejects a non-integer approval timestamp', async () => {
    const settlement = buildRoot({ epoch: 0, policyVersion: '1.0.0', monthlyBudget: '10000', candidates: [candidate(1)] });
    const artifact = settlementArtifact(settlement);
    const stored = new Set<Hex32>([artifact.artifactSha256]);
    const store: SettlementArtifactStore = {
      async put(hash) { stored.add(hash); },
      async has(hash) { return stored.has(hash); },
    };
    const registry = `0x${'12'.repeat(20)}` as const;
    const signature = await DEVICE.signMessage({
      message: rootApprovalMessage({
        chainId: 31337,
        registry,
        epoch: settlement.epoch,
        artifactSha256: artifact.artifactSha256,
        approvedAt: Number.NaN,
      }),
    });
    await expect(prepareRootProposal({
      settlement,
      store,
      chainId: 31337,
      registryAddress: registry,
      approval: {
        approvedBy: DEVICE.address,
        approvedAt: Number.NaN,
        artifactSha256: artifact.artifactSha256,
        signature,
      },
      authorizedProposers: new Set([DEVICE.address]),
      now: () => 1_000,
    })).rejects.toThrow('ROOT_APPROVAL_TIME_INVALID');
  });
});
