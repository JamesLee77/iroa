import { AddressSchema, Hex32Schema } from '@iroa/protocol';
import { z } from 'zod';
import type { IroaChainId } from './chains.js';

const ContractNameSchema = z.string().regex(/^[A-Z][A-Za-z0-9]{1,63}$/);
const GitCommitSchema = z.string().regex(/^[0-9a-f]{40}$/);

export const ContractDeploymentSchema = z.object({
  address: AddressSchema,
  transactionHash: Hex32Schema,
  bytecodeHash: Hex32Schema,
}).strict();

export const DeploymentManifestSchema = z.object({
  schemaVersion: z.literal(1),
  project: z.literal('IROA'),
  network: z.enum(['base', 'base-sepolia']),
  chainId: z.union([z.literal(8453), z.literal(84532)]),
  deploymentStatus: z.enum(['planned', 'deployed']),
  deploymentCommit: GitCommitSchema.nullable(),
  contracts: z.record(ContractNameSchema, ContractDeploymentSchema),
}).strict().superRefine((manifest, context) => {
  const expectedNetwork = manifest.chainId === 8453 ? 'base' : 'base-sepolia';
  if (manifest.network !== expectedNetwork) {
    context.addIssue({
      code: 'custom',
      message: `Network ${manifest.network} does not match chain ${manifest.chainId}`,
      path: ['network'],
    });
  }
  if (manifest.deploymentStatus === 'deployed') {
    if (manifest.deploymentCommit === null) {
      context.addIssue({ code: 'custom', message: 'A deployed manifest requires a commit', path: ['deploymentCommit'] });
    }
    if (Object.keys(manifest.contracts).length === 0) {
      context.addIssue({ code: 'custom', message: 'A deployed manifest requires contracts', path: ['contracts'] });
    }
  }
  const contractNameByAddress = new Map<string, string>();
  for (const [contractName, deployment] of Object.entries(manifest.contracts)) {
    const normalizedAddress = deployment.address.toLowerCase();
    const existingName = contractNameByAddress.get(normalizedAddress);
    if (existingName) {
      context.addIssue({
        code: 'custom',
        message: `Duplicate contract address shared by ${existingName} and ${contractName}`,
        path: ['contracts', contractName, 'address'],
      });
    } else {
      contractNameByAddress.set(normalizedAddress, contractName);
    }
  }
});

export type ContractDeployment = z.infer<typeof ContractDeploymentSchema>;
export type DeploymentManifest = z.infer<typeof DeploymentManifestSchema>;

export function assertManifestForChain(input: unknown, expectedChainId: IroaChainId): DeploymentManifest {
  const manifest = DeploymentManifestSchema.parse(input);
  if (manifest.chainId !== expectedChainId) {
    throw new Error(`Manifest chain ${manifest.chainId} does not match active chain ${expectedChainId}`);
  }
  return manifest;
}
