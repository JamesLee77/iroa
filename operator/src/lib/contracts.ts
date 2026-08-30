import type { RewardLeaf } from '@iroa/protocol';
import {
  encodeAbiParameters,
  formatUnits,
  keccak256,
  parseAbiParameters,
  parseUnits,
  type Address,
  type Hex,
} from 'viem';
import { operatorProfile } from './wagmi';

export const nodeRegistryAbi = [
  {
    type: 'function', name: 'registerNode', stateMutability: 'nonpayable', outputs: [],
    inputs: [
      { name: 'nodeId', type: 'bytes32' },
      { name: 'operatorIdHash', type: 'bytes32' },
      { name: 'deviceKeyHash', type: 'bytes32' },
      { name: 'trustLevel', type: 'uint8' },
    ],
  },
  { type: 'function', name: 'revokeDeviceKey', stateMutability: 'nonpayable', outputs: [], inputs: [{ name: 'nodeId', type: 'bytes32' }] },
  { type: 'function', name: 'suspendNode', stateMutability: 'nonpayable', outputs: [], inputs: [{ name: 'nodeId', type: 'bytes32' }] },
  { type: 'function', name: 'nodeStatus', stateMutability: 'view', outputs: [{ type: 'uint8' }], inputs: [{ name: 'nodeId', type: 'bytes32' }] },
  { type: 'function', name: 'deviceKeyNode', stateMutability: 'view', outputs: [{ type: 'bytes32' }], inputs: [{ name: 'deviceKeyHash', type: 'bytes32' }] },
  { type: 'function', name: 'operatorWallet', stateMutability: 'view', outputs: [{ type: 'address' }], inputs: [{ name: 'nodeId', type: 'bytes32' }] },
  { type: 'function', name: 'operatorIdHash', stateMutability: 'view', outputs: [{ type: 'bytes32' }], inputs: [{ name: 'nodeId', type: 'bytes32' }] },
  { type: 'function', name: 'SUSPENDER_ROLE', stateMutability: 'view', outputs: [{ type: 'bytes32' }], inputs: [] },
  { type: 'function', name: 'hasRole', stateMutability: 'view', outputs: [{ type: 'bool' }], inputs: [{ type: 'bytes32' }, { type: 'address' }] },
] as const;

export const rewardDistributorAbi = [
  {
    type: 'function', name: 'claim', stateMutability: 'nonpayable', outputs: [],
    inputs: [
      { name: 'epoch', type: 'uint64' },
      { name: 'operatorIdHash', type: 'bytes32' },
      { name: 'nodeId', type: 'bytes32' },
      { name: 'score', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
      { name: 'receiptBatchRoot', type: 'bytes32' },
      { name: 'policyVersion', type: 'string' },
      { name: 'claimNonce', type: 'bytes32' },
      { name: 'proof', type: 'bytes32[]' },
    ],
  },
  { type: 'function', name: 'claimed', stateMutability: 'view', outputs: [{ type: 'bool' }], inputs: [{ name: 'leafHash', type: 'bytes32' }] },
] as const;

export const tokenAbi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', outputs: [{ type: 'uint256' }], inputs: [{ type: 'address' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', outputs: [{ type: 'uint256' }], inputs: [] },
  { type: 'function', name: 'allowance', stateMutability: 'view', outputs: [{ type: 'uint256' }], inputs: [{ type: 'address' }, { type: 'address' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', outputs: [{ type: 'bool' }], inputs: [{ type: 'address' }, { type: 'uint256' }] },
] as const;

export const migrationAbi = [
  { type: 'function', name: 'migrate', stateMutability: 'nonpayable', outputs: [], inputs: [{ name: 'amount', type: 'uint256' }] },
  { type: 'function', name: 'migrationBurned', stateMutability: 'view', outputs: [{ type: 'uint256' }], inputs: [] },
  { type: 'function', name: 'migrationMinted', stateMutability: 'view', outputs: [{ type: 'uint256' }], inputs: [] },
] as const;

const REWARD_LEAF_ABI = parseAbiParameters(
  'uint64 epoch, bytes32 operatorIdHash, bytes32 nodeId, uint256 score, uint256 rewardAmount, bytes32 receiptBatchRoot, string policyVersion, bytes32 claimNonce',
);

export function rewardLeafHash(leaf: RewardLeaf): Hex {
  const inner = keccak256(encodeAbiParameters(REWARD_LEAF_ABI, [
    BigInt(leaf.epoch),
    leaf.operatorIdHash,
    leaf.nodeId,
    BigInt(leaf.score),
    BigInt(leaf.rewardAmount),
    leaf.receiptBatchRoot,
    leaf.policyVersion,
    leaf.claimNonce,
  ]));
  return keccak256(inner);
}

export function parseIroaAmount(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)(?:\.[0-9]{1,18})?$/.test(value)) throw new Error('INVALID_IROA_AMOUNT');
  const parsed = parseUnits(value, 18);
  if (parsed <= 0n) throw new Error('INVALID_IROA_AMOUNT');
  return parsed;
}

export function formatIroa(value: bigint | string): string {
  const raw = typeof value === 'string' ? BigInt(value) : value;
  const [whole, fraction = ''] = formatUnits(raw, 18).split('.');
  const compactFraction = fraction.replace(/0+$/, '');
  return `${BigInt(whole ?? '0').toLocaleString()}${compactFraction ? `.${compactFraction}` : ''}`;
}

export function assertSuccessfulReceipt(receipt: { status: 'success' | 'reverted' }): void {
  if (receipt.status !== 'success') throw new Error('TRANSACTION_REVERTED');
}

export function requireContract(name: keyof typeof operatorProfile.contracts): Address {
  const address = operatorProfile.contracts[name];
  if (!address) throw new Error(`CONTRACT_NOT_CONFIGURED:${name}`);
  return address;
}

export function migrationConfigured(): boolean {
  return Boolean(operatorProfile.contracts.tokenV2 && operatorProfile.contracts.migration);
}

export function trustLevelCode(level: 'N0' | 'N1' | 'N2' | 'N3'): number {
  return Number(level.slice(1));
}
