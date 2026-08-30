import type { DeletionReceipt, ResultReceipt, RewardLeaf } from '@iroa/protocol';
import { describe, expect, it } from 'vitest';
import { hashTypedData } from 'viem';
import {
  buildRewardTree,
  deletionReceiptTypedData,
  hashOperatorId,
  resultReceiptTypedData,
  verifyRewardProof,
} from './index.js';

const hashA = `0x${'11'.repeat(32)}` as const;
const hashB = `0x${'22'.repeat(32)}` as const;
const hashC = `0x${'33'.repeat(32)}` as const;
const address = `0x${'44'.repeat(20)}` as const;
const signature = `0x${'55'.repeat(65)}` as const;

const resultReceipt: ResultReceipt = {
  chainId: 84532,
  verifyingContract: address,
  policyVersion: '1.0.0',
  nonce: hashA,
  taskId: hashA,
  nodeId: hashB,
  operatorIdHash: hashC,
  startedAt: 1_800_000_000,
  completedAt: 1_800_000_001,
  resultHash: hashB,
  outcomeCode: 'COMPLETED',
  accessibilityMetricsHash: hashC,
  nodeSignature: signature,
};

const deletionReceipt: DeletionReceipt = {
  chainId: 84532,
  verifyingContract: address,
  policyVersion: '1.0.0',
  nonce: hashA,
  taskId: hashA,
  nodeId: hashB,
  deletedAt: 1_800_000_002,
  storageScopeHash: hashB,
  runtimeImageHash: hashC,
  deletionMethod: 'cryptographic-erasure',
  nodeSignature: signature,
};

const rewardLeaf: RewardLeaf = {
  epoch: 1_800_000_000,
  operatorIdHash: hashC,
  nodeId: hashB,
  score: '10000',
  rewardAmount: '1000000000000000000',
  receiptBatchRoot: hashA,
  policyVersion: '1.0.0',
  claimNonce: hashB,
};

describe('IROA cryptography', () => {
  it('builds deterministic chain-bound receipt digests', () => {
    const domain = { chainId: 84532, verifyingContract: address, version: '1' } as const;
    const firstDigest = hashTypedData(resultReceiptTypedData(domain, resultReceipt));
    const secondDigest = hashTypedData(resultReceiptTypedData(domain, resultReceipt));
    const mainnetReceipt = { ...resultReceipt, chainId: 8453 } satisfies ResultReceipt;
    const mainnetDigest = hashTypedData(
      resultReceiptTypedData(
        { chainId: 8453, verifyingContract: address, version: '1' },
        mainnetReceipt,
      ),
    );
    expect(firstDigest).toBe(secondDigest);
    expect(mainnetDigest).not.toBe(firstDigest);
    expect(() =>
      resultReceiptTypedData(
        { chainId: 8453, verifyingContract: address, version: '1' },
        resultReceipt,
      ),
    ).toThrow(/does not match/);
    expect(hashTypedData(deletionReceiptTypedData(domain, deletionReceipt))).not.toBe(firstDigest);
  });

  it('rejects a domain version that differs from the receipt policy major', () => {
    expect(() =>
      resultReceiptTypedData(
        { chainId: 84532, verifyingContract: address, version: '2' },
        resultReceipt,
      ),
    ).toThrow(/policy major/);
  });

  it('rejects malformed receipts at the signing boundary', () => {
    expect(() =>
      resultReceiptTypedData(
        { chainId: 84532, verifyingContract: address, version: '1' },
        { ...resultReceipt, nonce: '0x1234' } as ResultReceipt,
      ),
    ).toThrow();
  });

  it('salts operator identifiers before hashing', () => {
    expect(hashOperatorId('Operator-A', hashA)).toBe(hashOperatorId(' operator-a ', hashA));
    expect(hashOperatorId('Operator-A', hashA)).not.toBe(hashOperatorId('Operator-A', hashB));
  });

  it('normalizes equivalent operator identifiers before hashing', () => {
    expect(hashOperatorId('Opérator-A', hashA)).toBe(hashOperatorId('Ope\u0301rator-A', hashA));
  });

  it('builds deterministic proofs and rejects an invalid proof', () => {
    const tree = buildRewardTree([rewardLeaf]);
    expect(buildRewardTree([rewardLeaf]).root).toBe(tree.root);
    expect(verifyRewardProof(tree.root, rewardLeaf, tree.claims[0]?.proof ?? [])).toBe(true);
    expect(verifyRewardProof(hashB, rewardLeaf, tree.claims[0]?.proof ?? [])).toBe(false);
  });

  it('rejects duplicate reward leaves', () => {
    expect(() => buildRewardTree([rewardLeaf, rewardLeaf])).toThrow(/Duplicate reward leaf/);
  });
});
