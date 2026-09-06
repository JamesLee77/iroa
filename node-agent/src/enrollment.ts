import { createHash } from 'node:crypto';
import type { Address, Hex32, PolicyVersion } from '@iroa/protocol';
import { AddressSchema, Hex32Schema, PolicyVersionSchema } from '@iroa/protocol';
import { encodePacked, getAddress, keccak256, type Hex } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';

export interface DeviceSecretProvider {
  withPrivateKey<T>(consumer: (privateKey: Hex) => Promise<T>): Promise<T>;
  version(): Promise<string>;
}

export class InjectedSecretProvider implements DeviceSecretProvider {
  constructor(
    private readonly resolveSecret: () => Promise<Hex>,
    private readonly resolveVersion: () => Promise<string>,
  ) {}

  async withPrivateKey<T>(consumer: (privateKey: Hex) => Promise<T>): Promise<T> {
    const secret = await this.resolveSecret();
    if (!/^0x[0-9a-fA-F]{64}$/.test(secret)) throw new Error('INVALID_DEVICE_PRIVATE_KEY');
    return consumer(secret);
  }

  async version(): Promise<string> {
    const version = await this.resolveVersion();
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(version)) throw new Error('INVALID_DEVICE_KEY_VERSION');
    return version;
  }
}

export interface ControlApiTransport {
  post<T>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    options?: { headers?: Readonly<Record<string, string>> },
  ): Promise<T>;
}

export interface DeviceIdentity {
  deviceAddress: Address;
  deviceKeyHash: Hex32;
  keyVersion: string;
}

export interface EnrollmentRecord extends DeviceIdentity {
  nodeId: Hex32;
  trustLevel: 'N0' | 'N1' | 'N2' | 'N3';
  policyVersion: PolicyVersion;
  status: 'pending' | 'active' | 'suspended' | 'revoked';
}

function accountIdentity(account: PrivateKeyAccount, keyVersion: string): DeviceIdentity {
  const deviceAddress = AddressSchema.parse(getAddress(account.address));
  const deviceKeyHash = Hex32Schema.parse(keccak256(encodePacked(['address'], [deviceAddress])));
  return { deviceAddress, deviceKeyHash, keyVersion };
}

export function deriveNodeId(operatorAddressInput: string, deviceKeyHash: Hex32): Hex32 {
  const operatorAddress = AddressSchema.parse(operatorAddressInput);
  return `0x${createHash('sha256')
    .update(`${operatorAddress.toLowerCase()}:${deviceKeyHash}`)
    .digest('hex')}` as Hex32;
}

export interface NodeRegistryDomain {
  chainId: number;
  verifyingContract: Address;
}

export const NODE_REGISTRATION_TYPES = {
  NodeRegistration: [
    { name: 'nodeId', type: 'bytes32' },
    { name: 'operatorWallet', type: 'address' },
    { name: 'operatorIdHash', type: 'bytes32' },
    { name: 'trustLevel', type: 'uint8' },
  ],
} as const;

const TRUST_LEVEL_CODE = { N0: 0, N1: 1, N2: 2, N3: 3 } as const;

export function nodeRegistrationTypedData(
  domain: NodeRegistryDomain,
  registration: { nodeId: Hex32; operatorWallet: Address; operatorIdHash: Hex32; trustLevel: keyof typeof TRUST_LEVEL_CODE },
) {
  return {
    domain: { name: 'IROANodeRegistry', version: '1', chainId: domain.chainId, verifyingContract: domain.verifyingContract },
    types: NODE_REGISTRATION_TYPES,
    primaryType: 'NodeRegistration' as const,
    message: {
      nodeId: registration.nodeId,
      operatorWallet: registration.operatorWallet,
      operatorIdHash: registration.operatorIdHash,
      trustLevel: TRUST_LEVEL_CODE[registration.trustLevel],
    },
  };
}

/**
 * Proof that this device holds the key behind its hash: the on-chain registry only binds
 * a device-key hash to a NODE when the device signed the registration for exactly this
 * operator wallet, operator id, and trust level. The signature is what the operator pastes
 * into the portal alongside the challenge signature.
 */
export async function signNodeRegistration(input: {
  secretProvider: DeviceSecretProvider;
  domain: NodeRegistryDomain;
  operatorAddress: string;
  operatorIdHash: Hex32;
  trustLevel: keyof typeof TRUST_LEVEL_CODE;
}): Promise<{ nodeId: Hex32; deviceKeyHash: Hex32; deviceAddress: Address; signature: Hex }> {
  const identity = await getDeviceIdentity(input.secretProvider);
  const operatorWallet = AddressSchema.parse(getAddress(input.operatorAddress));
  const nodeId = deriveNodeId(operatorWallet, identity.deviceKeyHash);
  const typedData = nodeRegistrationTypedData(input.domain, {
    nodeId,
    operatorWallet,
    operatorIdHash: Hex32Schema.parse(input.operatorIdHash),
    trustLevel: input.trustLevel,
  });
  const signature = await input.secretProvider.withPrivateKey((privateKey) =>
    privateKeyToAccount(privateKey).signTypedData(typedData),
  );
  return { nodeId, deviceKeyHash: identity.deviceKeyHash, deviceAddress: identity.deviceAddress, signature };
}

export async function getDeviceIdentity(secretProvider: DeviceSecretProvider): Promise<DeviceIdentity> {
  const keyVersion = await secretProvider.version();
  return secretProvider.withPrivateKey(async (privateKey) => accountIdentity(privateKeyToAccount(privateKey), keyVersion));
}

export async function enrollNode(input: {
  transport: ControlApiTransport;
  secretProvider: DeviceSecretProvider;
  operatorAddress: string;
  trustLevel: 'N0' | 'N1' | 'N2' | 'N3';
  policyVersion: string;
}): Promise<EnrollmentRecord> {
  const policyVersion = PolicyVersionSchema.parse(input.policyVersion);
  const identity = await getDeviceIdentity(input.secretProvider);
  const nodeId = deriveNodeId(input.operatorAddress, identity.deviceKeyHash);
  const challenge = await input.transport.post<{ nonce: string; expiresAt: number; message: string }>(
    '/v1/auth/nodes/challenge',
    { nodeId, deviceAddress: identity.deviceAddress },
  );
  const deviceSignature = await input.secretProvider.withPrivateKey((privateKey) =>
    privateKeyToAccount(privateKey).signMessage({ message: challenge.message }),
  );
  const record = await input.transport.post<EnrollmentRecord>('/v1/nodes/enroll', {
    deviceAddress: identity.deviceAddress,
    deviceKeyHash: identity.deviceKeyHash,
    trustLevel: input.trustLevel,
    policyVersion,
    challengeNonce: challenge.nonce,
    deviceSignature,
  });
  if (record.nodeId !== nodeId || record.deviceAddress.toLowerCase() !== identity.deviceAddress.toLowerCase()) {
    throw new Error('ENROLLMENT_READBACK_MISMATCH');
  }
  return { ...record, keyVersion: identity.keyVersion };
}
