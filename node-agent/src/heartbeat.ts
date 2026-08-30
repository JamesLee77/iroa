import type { Hex32, PolicyVersion } from '@iroa/protocol';
import { Hex32Schema, PolicyVersionSchema } from '@iroa/protocol';
import { z } from 'zod';
import { privateKeyToAccount } from 'viem/accounts';
import type { ControlApiTransport, DeviceIdentity, DeviceSecretProvider } from './enrollment.js';
import { getDeviceIdentity } from './enrollment.js';

export const CapacityBucketSchema = z.enum(['idle', 'low', 'medium', 'high']);
export type CapacityBucket = z.infer<typeof CapacityBucketSchema>;

export interface SignedHeartbeatRequest {
  nodeId: Hex32;
  identity: DeviceIdentity;
  body: {
    agentVersion: string;
    policyVersion: PolicyVersion;
    capacityBucket: CapacityBucket;
  };
  headers: Readonly<Record<string, string>>;
}

export async function createSignedHeartbeat(input: {
  transport: ControlApiTransport;
  secretProvider: DeviceSecretProvider;
  nodeId: string;
  agentVersion: string;
  policyVersion: string;
  capacityBucket: CapacityBucket;
}): Promise<SignedHeartbeatRequest> {
  const nodeId = Hex32Schema.parse(input.nodeId);
  const identity = await getDeviceIdentity(input.secretProvider);
  const agentVersion = z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/).max(64).parse(input.agentVersion);
  const policyVersion = PolicyVersionSchema.parse(input.policyVersion);
  const capacityBucket = CapacityBucketSchema.parse(input.capacityBucket);
  const challenge = await input.transport.post<{ nonce: string; expiresAt: number; message: string }>(
    '/v1/auth/nodes/challenge',
    { nodeId, deviceAddress: identity.deviceAddress },
  );
  const signature = await input.secretProvider.withPrivateKey((privateKey) =>
    privateKeyToAccount(privateKey).signMessage({ message: challenge.message }),
  );
  return {
    nodeId,
    identity,
    body: { agentVersion, policyVersion, capacityBucket },
    headers: {
      'x-iroa-node-id': nodeId,
      'x-iroa-node-challenge': challenge.nonce,
      'x-iroa-node-signature': signature,
    },
  };
}

export async function sendHeartbeat(input: Parameters<typeof createSignedHeartbeat>[0]): Promise<void> {
  const request = await createSignedHeartbeat(input);
  await input.transport.post('/v1/nodes/heartbeat', request.body, { headers: request.headers });
}
