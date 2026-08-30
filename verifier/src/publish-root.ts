import type { Address, Hex32 } from '@iroa/protocol';
import { AddressSchema, ChainIdSchema, Hex32Schema, SignatureSchema } from '@iroa/protocol';
import { encodeFunctionData, getAddress, keccak256, stringToBytes, verifyMessage, type Hex } from 'viem';
import { canonicalJson, sha256Hex } from './canonical.js';
import type { RewardSettlement } from './build-root.js';

const ROOT_REGISTRY_ABI = [{
  type: 'function',
  name: 'proposeRoot',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'epoch', type: 'uint64' },
    { name: 'rewardRoot', type: 'bytes32' },
    { name: 'receiptBatchRoot', type: 'bytes32' },
    { name: 'policyVersionHash', type: 'bytes32' },
  ],
  outputs: [],
}] as const;

export interface SettlementArtifactStore {
  put(artifactSha256: Hex32, canonicalArtifact: string): Promise<void>;
  has(artifactSha256: Hex32): Promise<boolean>;
}

export interface PublicationApproval {
  readonly approvedBy: Address;
  readonly approvedAt: number;
  readonly artifactSha256: Hex32;
  readonly signature: Hex;
}

export interface RootProposalTransaction {
  readonly to: Address;
  readonly data: Hex;
  readonly value: 0n;
  readonly artifactSha256: Hex32;
  readonly policyVersionHash: Hex32;
}

export function settlementArtifact(settlement: RewardSettlement): { canonicalArtifact: string; artifactSha256: Hex32 } {
  const canonicalArtifact = canonicalJson(settlement);
  return { canonicalArtifact, artifactSha256: sha256Hex(canonicalArtifact) };
}

export async function persistSettlementArtifact(
  store: SettlementArtifactStore,
  settlement: RewardSettlement,
): Promise<Hex32> {
  const artifact = settlementArtifact(settlement);
  await store.put(artifact.artifactSha256, artifact.canonicalArtifact);
  if (!await store.has(artifact.artifactSha256)) throw new Error('SETTLEMENT_ARTIFACT_NOT_DURABLE');
  return artifact.artifactSha256;
}

export function rootApprovalMessage(input: {
  chainId: number;
  registry: Address;
  epoch: number;
  artifactSha256: Hex32;
  approvedAt: number;
}): string {
  return [
    'IROA ROOT PROPOSAL APPROVAL',
    `Chain ID: ${input.chainId}`,
    `Registry: ${input.registry}`,
    `Epoch: ${input.epoch}`,
    `Artifact SHA-256: ${input.artifactSha256}`,
    `Approved At: ${input.approvedAt}`,
  ].join('\n');
}

export async function prepareRootProposal(input: {
  readonly settlement: RewardSettlement;
  readonly store: SettlementArtifactStore;
  readonly chainId: number;
  readonly registryAddress: string;
  readonly approval: PublicationApproval;
  readonly authorizedProposers: ReadonlySet<string>;
  readonly now?: () => number;
}): Promise<RootProposalTransaction> {
  if (!input.settlement.rewardRoot || !input.settlement.receiptBatchRoot || input.settlement.claims.length === 0) {
    throw new Error('EMPTY_SETTLEMENT_NOT_PUBLISHABLE');
  }
  const chainId = ChainIdSchema.parse(input.chainId);
  const registry = getAddress(AddressSchema.parse(input.registryAddress));
  const approvedBy = getAddress(AddressSchema.parse(input.approval.approvedBy));
  const artifactSha256 = Hex32Schema.parse(input.approval.artifactSha256);
  const signature = SignatureSchema.parse(input.approval.signature);
  const artifact = settlementArtifact(input.settlement);
  if (artifact.artifactSha256 !== artifactSha256) throw new Error('PUBLICATION_ARTIFACT_MISMATCH');
  if (!await input.store.has(artifactSha256)) throw new Error('SETTLEMENT_ARTIFACT_NOT_DURABLE');
  const authorized = new Set([...input.authorizedProposers].map((address) => getAddress(AddressSchema.parse(address))));
  if (!authorized.has(approvedBy)) throw new Error('ROOT_PROPOSER_NOT_AUTHORIZED');
  const now = (input.now ?? (() => Math.floor(Date.now() / 1_000)))();
  if (
    !Number.isSafeInteger(input.approval.approvedAt)
    || input.approval.approvedAt < 0
    || !Number.isSafeInteger(now)
    || now < 0
  ) {
    throw new Error('ROOT_APPROVAL_TIME_INVALID');
  }
  if (input.approval.approvedAt > now + 30 || input.approval.approvedAt < now - 15 * 60) {
    throw new Error('ROOT_APPROVAL_EXPIRED');
  }
  const valid = await verifyMessage({
    address: approvedBy,
    message: rootApprovalMessage({
      chainId,
      registry,
      epoch: input.settlement.epoch,
      artifactSha256,
      approvedAt: input.approval.approvedAt,
    }),
    signature,
  });
  if (!valid) throw new Error('ROOT_APPROVAL_SIGNATURE_INVALID');
  const policyVersionHash = keccak256(stringToBytes(input.settlement.policyVersion)) as Hex32;
  return {
    to: registry,
    data: encodeFunctionData({
      abi: ROOT_REGISTRY_ABI,
      functionName: 'proposeRoot',
      args: [
        BigInt(input.settlement.epoch),
        input.settlement.rewardRoot,
        input.settlement.receiptBatchRoot,
        policyVersionHash,
      ],
    }),
    value: 0n,
    artifactSha256,
    policyVersionHash,
  };
}
