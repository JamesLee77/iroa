import {
  deletionReceiptTypedData,
  resultReceiptTypedData,
  type ReceiptDomainInput,
} from '@iroa/crypto';
import {
  AddressSchema,
  DeletionReceiptSchema,
  Hex32Schema,
  PolicyVersionSchema,
  ResultReceiptSchema,
  UnixSecondsSchema,
  type DeletionReceipt,
  type Hex32,
  type ResultReceipt,
} from '@iroa/protocol';
import { encodePacked, getAddress, keccak256, toBytes, verifyTypedData } from 'viem';
import { z } from 'zod';
import { canonicalJson, sha256Hex } from './canonical.js';

const NodeStatusIntervalSchema = z.object({
  status: z.enum(['pending', 'active', 'suspended', 'revoked']),
  startsAt: UnixSecondsSchema,
  endsAt: UnixSecondsSchema.nullable(),
}).strict().refine((interval) => interval.endsAt === null || interval.endsAt > interval.startsAt, {
  message: 'NODE_STATUS_INTERVAL_INVALID',
});

export const NodeStatusSnapshotSchema = z.object({
  nodeId: Hex32Schema,
  operatorIdHash: Hex32Schema,
  operatorWallet: AddressSchema,
  deviceAddress: AddressSchema,
  deviceKeyHash: Hex32Schema,
  capturedAt: UnixSecondsSchema,
  intervals: z.array(NodeStatusIntervalSchema).min(1).max(256),
}).strict();

export type NodeStatusSnapshot = z.infer<typeof NodeStatusSnapshotSchema>;

export interface VerifiedReceiptPair {
  readonly result: ResultReceipt;
  readonly deletion: DeletionReceipt;
  readonly node: NodeStatusSnapshot;
  readonly receiptPairHash: Hex32;
}

function assertStatusHistory(snapshot: NodeStatusSnapshot): void {
  const intervals = [...snapshot.intervals].sort((left, right) => left.startsAt - right.startsAt);
  for (let index = 0; index < intervals.length; index += 1) {
    const current = intervals[index];
    if (!current) throw new Error('NODE_STATUS_HISTORY_INVALID');
    const next = intervals[index + 1];
    if (next && (current.endsAt === null || current.endsAt > next.startsAt)) {
      throw new Error('NODE_STATUS_HISTORY_OVERLAP');
    }
  }
}

function activeAt(snapshot: NodeStatusSnapshot, timestamp: number): boolean {
  return snapshot.intervals.some((interval) => (
    interval.status === 'active'
    && interval.startsAt <= timestamp
    && (interval.endsAt === null || timestamp < interval.endsAt)
  ));
}

function assertPairContext(result: ResultReceipt, deletion: DeletionReceipt): void {
  const fields = ['taskId', 'nodeId', 'nonce', 'policyVersion', 'chainId', 'verifyingContract'] as const;
  for (const field of fields) {
    if (String(result[field]).toLowerCase() !== String(deletion[field]).toLowerCase()) {
      throw new Error(`RECEIPT_PAIR_${field.toUpperCase()}_MISMATCH`);
    }
  }
  if (deletion.deletedAt < result.completedAt) throw new Error('DELETION_PRECEDES_RESULT');
}

export async function verifyReceiptPair(input: {
  readonly result: unknown;
  readonly deletion: unknown;
  readonly nodeSnapshot: unknown;
  readonly expectedPolicyVersion: string;
  readonly domain: ReceiptDomainInput;
}): Promise<VerifiedReceiptPair> {
  const result = ResultReceiptSchema.parse(input.result);
  const deletion = DeletionReceiptSchema.parse(input.deletion);
  const node = NodeStatusSnapshotSchema.parse(input.nodeSnapshot);
  const expectedPolicyVersion = PolicyVersionSchema.parse(input.expectedPolicyVersion);
  assertStatusHistory(node);
  assertPairContext(result, deletion);
  if (result.policyVersion !== expectedPolicyVersion) throw new Error('RECEIPT_POLICY_DRIFT');
  if (result.nodeId !== node.nodeId || result.operatorIdHash !== node.operatorIdHash) {
    throw new Error('RECEIPT_NODE_SNAPSHOT_MISMATCH');
  }
  if (sha256Hex(getAddress(node.operatorWallet)) !== node.operatorIdHash) {
    throw new Error('OPERATOR_ID_SNAPSHOT_MISMATCH');
  }
  const deviceAddress = getAddress(node.deviceAddress);
  const expectedDeviceKeyHash = Hex32Schema.parse(
    keccak256(encodePacked(['address'], [deviceAddress])),
  );
  if (expectedDeviceKeyHash !== node.deviceKeyHash) throw new Error('DEVICE_KEY_SNAPSHOT_MISMATCH');
  if (!activeAt(node, result.completedAt)) throw new Error('NODE_INACTIVE_AT_COMPLETION');
  if (node.capturedAt < deletion.deletedAt) throw new Error('NODE_SNAPSHOT_TOO_OLD');

  const resultSignatureValid = await verifyTypedData({
    address: deviceAddress,
    ...resultReceiptTypedData(input.domain, result),
    signature: result.nodeSignature,
  });
  if (!resultSignatureValid) throw new Error('RESULT_SIGNATURE_INVALID');
  const deletionSignatureValid = await verifyTypedData({
    address: deviceAddress,
    ...deletionReceiptTypedData(input.domain, deletion),
    signature: deletion.nodeSignature,
  });
  if (!deletionSignatureValid) throw new Error('DELETION_SIGNATURE_INVALID');

  const receiptPairHash = keccak256(toBytes(canonicalJson({ result, deletion }))) as Hex32;
  return { result, deletion, node, receiptPairHash };
}
