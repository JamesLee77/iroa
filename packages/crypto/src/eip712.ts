import {
  UnsignedDeletionReceiptSchema,
  UnsignedResultReceiptSchema,
  type DeletionReceipt,
  type ResultReceipt,
  type UnsignedDeletionReceipt,
  type UnsignedResultReceipt,
} from '@iroa/protocol';
import type { TypedDataDefinition } from 'viem';

export type ReceiptDomainInput = {
  chainId: 8453 | 84532 | 31337;
  verifyingContract: `0x${string}`;
  version: string;
};

const RESULT_RECEIPT_TYPES = {
  ResultReceipt: [
    { name: 'taskId', type: 'bytes32' },
    { name: 'nodeId', type: 'bytes32' },
    { name: 'operatorIdHash', type: 'bytes32' },
    { name: 'startedAt', type: 'uint64' },
    { name: 'completedAt', type: 'uint64' },
    { name: 'resultHash', type: 'bytes32' },
    { name: 'outcomeCode', type: 'string' },
    { name: 'accessibilityMetricsHash', type: 'bytes32' },
    { name: 'policyVersion', type: 'string' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

const DELETION_RECEIPT_TYPES = {
  DeletionReceipt: [
    { name: 'taskId', type: 'bytes32' },
    { name: 'nodeId', type: 'bytes32' },
    { name: 'deletedAt', type: 'uint64' },
    { name: 'storageScopeHash', type: 'bytes32' },
    { name: 'runtimeImageHash', type: 'bytes32' },
    { name: 'deletionMethod', type: 'string' },
    { name: 'policyVersion', type: 'string' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const;

function receiptDomain(input: ReceiptDomainInput) {
  return {
    name: 'IROA Receipt',
    version: input.version,
    chainId: input.chainId,
    verifyingContract: input.verifyingContract,
  } as const;
}

function assertReceiptDomain(
  receipt: Pick<UnsignedResultReceipt | UnsignedDeletionReceipt, 'chainId' | 'verifyingContract' | 'policyVersion'>,
  domain: ReceiptDomainInput,
): void {
  if (receipt.chainId !== domain.chainId) {
    throw new Error(`Receipt chain ${receipt.chainId} does not match domain chain ${domain.chainId}`);
  }
  if (receipt.verifyingContract.toLowerCase() !== domain.verifyingContract.toLowerCase()) {
    throw new Error('Receipt verifying contract does not match EIP-712 domain');
  }
  if (!/^[1-9][0-9]*$/.test(domain.version)) {
    throw new Error('Receipt domain version must be a positive policy major version');
  }
  const [policyMajor] = receipt.policyVersion.split('.');
  if (policyMajor !== domain.version) {
    throw new Error(
      `Receipt policy major ${policyMajor ?? 'unknown'} does not match domain version ${domain.version}`,
    );
  }
}

export function resultReceiptTypedData(
  domain: ReceiptDomainInput,
  receipt: UnsignedResultReceipt | ResultReceipt,
): TypedDataDefinition {
  const { nodeSignature: _signature, ...unsignedReceipt } = receipt as ResultReceipt;
  const parsedReceipt = UnsignedResultReceiptSchema.parse(unsignedReceipt);
  assertReceiptDomain(parsedReceipt, domain);
  const { chainId: _chainId, verifyingContract: _contract, ...message } = parsedReceipt;

  return {
    domain: receiptDomain(domain),
    types: RESULT_RECEIPT_TYPES,
    primaryType: 'ResultReceipt',
    message,
  };
}

export function deletionReceiptTypedData(
  domain: ReceiptDomainInput,
  receipt: UnsignedDeletionReceipt | DeletionReceipt,
): TypedDataDefinition {
  const { nodeSignature: _signature, ...unsignedReceipt } = receipt as DeletionReceipt;
  const parsedReceipt = UnsignedDeletionReceiptSchema.parse(unsignedReceipt);
  assertReceiptDomain(parsedReceipt, domain);
  const { chainId: _chainId, verifyingContract: _contract, ...message } = parsedReceipt;

  return {
    domain: receiptDomain(domain),
    types: DELETION_RECEIPT_TYPES,
    primaryType: 'DeletionReceipt',
    message,
  };
}
