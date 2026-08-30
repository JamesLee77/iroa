import { encodeFunctionData, keccak256, stringToBytes, type Address, type Hex } from 'viem';
import type { AdminSettlement } from './api';

const ROOT_REGISTRY_ABI = [{
  type: 'function', name: 'proposeRoot', stateMutability: 'nonpayable', outputs: [],
  inputs: [
    { name: 'epoch', type: 'uint64' },
    { name: 'rewardRoot', type: 'bytes32' },
    { name: 'receiptBatchRoot', type: 'bytes32' },
    { name: 'policyVersionHash', type: 'bytes32' },
  ],
}] as const;

export interface RootProposalTransaction {
  readonly to: Address;
  readonly data: Hex;
  readonly value: '0';
  readonly artifactSha256: Hex;
  readonly policyVersionHash: Hex;
}

export interface SafeProposalArtifact {
  readonly schemaVersion: 1;
  readonly chainId: number;
  readonly safe: Address;
  readonly manifestHash: Hex;
  readonly artifactSha256: Hex;
  readonly epoch: number;
  readonly policyVersion: string;
  readonly payloadHash: Hex;
  readonly transactions: readonly [{ readonly to: Address; readonly value: '0'; readonly data: Hex; readonly operation: 0 }];
}

export function rootApprovalMessage(input: { chainId: number; registry: Address; epoch: number; artifactSha256: Hex; approvedAt: number }): string {
  return ['IROA ROOT PROPOSAL APPROVAL', `Chain ID: ${input.chainId}`, `Registry: ${input.registry}`, `Epoch: ${input.epoch}`, `Artifact SHA-256: ${input.artifactSha256}`, `Approved At: ${input.approvedAt}`].join('\n');
}

export function buildVerifiedSafeProposal(input: {
  settlement: AdminSettlement;
  transaction: RootProposalTransaction;
  profile: { chainId: number; safe: Address; rootRegistry: Address; manifestHash: Hex };
}): SafeProposalArtifact {
  const { settlement, profile } = input;
  if (!settlement.rewardRoot || !settlement.receiptBatchRoot || settlement.claims.length === 0) throw new Error('EMPTY_SETTLEMENT_NOT_PUBLISHABLE');
  const policyVersionHash = keccak256(stringToBytes(settlement.policyVersion));
  const data = encodeFunctionData({ abi: ROOT_REGISTRY_ABI, functionName: 'proposeRoot', args: [BigInt(settlement.epoch), settlement.rewardRoot, settlement.receiptBatchRoot, policyVersionHash] });
  if (
    input.transaction.to.toLowerCase() !== profile.rootRegistry.toLowerCase()
    || input.transaction.data.toLowerCase() !== data.toLowerCase()
    || input.transaction.value !== '0'
    || input.transaction.artifactSha256.toLowerCase() !== settlement.artifactSha256.toLowerCase()
    || input.transaction.policyVersionHash.toLowerCase() !== policyVersionHash.toLowerCase()
  ) throw new Error('ROOT_PROPOSAL_TRANSACTION_MISMATCH');
  const body = { chainId: profile.chainId, safe: profile.safe, manifestHash: profile.manifestHash, artifactSha256: settlement.artifactSha256, epoch: settlement.epoch, policyVersion: settlement.policyVersion, transactions: [{ to: input.transaction.to, value: input.transaction.value, data: input.transaction.data, operation: 0 as const }] };
  return { schemaVersion: 1, ...body, payloadHash: keccak256(stringToBytes(JSON.stringify(body))) };
}
