import {
  deletionReceiptTypedData,
  resultReceiptTypedData,
  type ReceiptDomainInput,
} from '@iroa/crypto';
import {
  DeletionReceiptSchema,
  ResultReceiptSchema,
  UnsignedDeletionReceiptSchema,
  UnsignedResultReceiptSchema,
  type DeletionReceipt,
  type ResultReceipt,
  type UnsignedDeletionReceipt,
  type UnsignedResultReceipt,
} from '@iroa/protocol';
import { getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { DeviceSecretProvider } from './enrollment.js';

function assertSigner(expectedDeviceAddress: string, actualDeviceAddress: string): void {
  if (getAddress(expectedDeviceAddress) !== getAddress(actualDeviceAddress)) {
    throw new Error('RECEIPT_SIGNER_MISMATCH');
  }
}

export async function signResultReceipt(input: {
  readonly secretProvider: DeviceSecretProvider;
  readonly expectedDeviceAddress: string;
  readonly domain: ReceiptDomainInput;
  readonly receipt: UnsignedResultReceipt;
}): Promise<ResultReceipt> {
  const receipt = UnsignedResultReceiptSchema.parse(input.receipt);
  const nodeSignature = await input.secretProvider.withPrivateKey(async (privateKey) => {
    const account = privateKeyToAccount(privateKey);
    assertSigner(input.expectedDeviceAddress, account.address);
    return account.signTypedData(resultReceiptTypedData(input.domain, receipt));
  });
  return ResultReceiptSchema.parse({ ...receipt, nodeSignature });
}

export async function signDeletionReceipt(input: {
  readonly secretProvider: DeviceSecretProvider;
  readonly expectedDeviceAddress: string;
  readonly domain: ReceiptDomainInput;
  readonly receipt: UnsignedDeletionReceipt;
}): Promise<DeletionReceipt> {
  const receipt = UnsignedDeletionReceiptSchema.parse(input.receipt);
  const nodeSignature = await input.secretProvider.withPrivateKey(async (privateKey) => {
    const account = privateKeyToAccount(privateKey);
    assertSigner(input.expectedDeviceAddress, account.address);
    return account.signTypedData(deletionReceiptTypedData(input.domain, receipt));
  });
  return DeletionReceiptSchema.parse({ ...receipt, nodeSignature });
}
