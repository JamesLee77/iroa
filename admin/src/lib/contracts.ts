import type { Address } from 'viem';
import type { AdminSettlement } from './api';
import { buildVerifiedSafeProposal, type RootProposalTransaction, type SafeProposalArtifact } from './settlement-proposal';
import { adminProfile } from './wagmi';

export { verifySettlementArtifact } from './settlement-integrity';
export { rootApprovalMessage, type RootProposalTransaction, type SafeProposalArtifact } from './settlement-proposal';

export const nodeRegistryAbi = [
  { type: 'function', name: 'approveNode', stateMutability: 'nonpayable', outputs: [], inputs: [{ name: 'nodeId', type: 'bytes32' }] },
  { type: 'function', name: 'suspendNode', stateMutability: 'nonpayable', outputs: [], inputs: [{ name: 'nodeId', type: 'bytes32' }] },
  { type: 'function', name: 'COMPLIANCE_ROLE', stateMutability: 'view', outputs: [{ type: 'bytes32' }], inputs: [] },
  { type: 'function', name: 'SUSPENDER_ROLE', stateMutability: 'view', outputs: [{ type: 'bytes32' }], inputs: [] },
  { type: 'function', name: 'hasRole', stateMutability: 'view', outputs: [{ type: 'bool' }], inputs: [{ type: 'bytes32' }, { type: 'address' }] },
] as const;

export const rootRegistryAbi = [
  { type: 'function', name: 'ROOT_PROPOSER_ROLE', stateMutability: 'view', outputs: [{ type: 'bytes32' }], inputs: [] },
  { type: 'function', name: 'CHALLENGER_ROLE', stateMutability: 'view', outputs: [{ type: 'bytes32' }], inputs: [] },
  { type: 'function', name: 'hasRole', stateMutability: 'view', outputs: [{ type: 'bool' }], inputs: [{ type: 'bytes32' }, { type: 'address' }] },
  {
    type: 'function', name: 'proposeRoot', stateMutability: 'nonpayable', outputs: [],
    inputs: [
      { name: 'epoch', type: 'uint64' },
      { name: 'rewardRoot', type: 'bytes32' },
      { name: 'receiptBatchRoot', type: 'bytes32' },
      { name: 'policyVersionHash', type: 'bytes32' },
    ],
  },
] as const;

export type RequiredRole = 'compliance' | 'suspender' | 'challenger' | 'rootProposer';

export function requireContract(name: keyof typeof adminProfile.contracts): Address {
  const value = adminProfile.contracts[name];
  if (!value) throw new Error(`CONTRACT_NOT_CONFIGURED:${name}`);
  return value;
}

export function buildRootSafeProposal(settlement: AdminSettlement, transaction: RootProposalTransaction): SafeProposalArtifact {
  if (!adminProfile.manifestHash) throw new Error('ADMIN_MANIFEST_REQUIRED');
  return buildVerifiedSafeProposal({
    settlement,
    transaction,
    profile: {
      chainId: adminProfile.chainId,
      safe: requireContract('safe'),
      rootRegistry: requireContract('rootRegistry'),
      manifestHash: adminProfile.manifestHash,
    },
  });
}

export function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
