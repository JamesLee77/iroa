import { z } from 'zod';
import { InjectedSecretProvider } from './enrollment.js';
import { CapacityBucketSchema, sendHeartbeat } from './heartbeat.js';
import { FetchControlApiTransport } from './transport.js';

const EnvironmentSchema = z.object({
  IROA_CONTROL_API_URL: z.string().url(),
  IROA_NODE_ID: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  IROA_AGENT_VERSION: z.string().min(1).max(64),
  IROA_POLICY_VERSION: z.string().regex(/^[1-9][0-9]*\.[0-9]+\.[0-9]+$/),
  IROA_CAPACITY_BUCKET: CapacityBucketSchema,
  IROA_DEVICE_KEY_VERSION: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/),
  IROA_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(30_000).max(300_000).default(60_000),
});

const DevicePrivateKeySchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);

const environment = EnvironmentSchema.parse(process.env);
const transport = new FetchControlApiTransport(environment.IROA_CONTROL_API_URL);
const secretProvider = new InjectedSecretProvider(
  async () => DevicePrivateKeySchema.parse(process.env.IROA_DEVICE_PRIVATE_KEY) as `0x${string}`,
  async () => environment.IROA_DEVICE_KEY_VERSION,
);

async function heartbeat(): Promise<void> {
  await sendHeartbeat({
    transport,
    secretProvider,
    nodeId: environment.IROA_NODE_ID,
    agentVersion: environment.IROA_AGENT_VERSION,
    policyVersion: environment.IROA_POLICY_VERSION,
    capacityBucket: environment.IROA_CAPACITY_BUCKET,
  });
}

await heartbeat();
const timer = setInterval(() => {
  void heartbeat().catch((error: unknown) => {
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'HEARTBEAT_FAILED';
    process.stderr.write(`${code}\n`);
  });
}, environment.IROA_HEARTBEAT_INTERVAL_MS);

function shutdown(): void {
  clearInterval(timer);
  process.exitCode = 0;
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
