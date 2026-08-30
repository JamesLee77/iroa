import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

type OperatorProfileName = 'base-sepolia' | 'base-mainnet-private';

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function selectedProfile(): { name: OperatorProfileName; chainId: 84532 | 8453; manifestProfile: string; chainExport: string } {
  const name = process.env.IROA_OPERATOR_PROFILE ?? 'base-sepolia';
  if (name === 'base-sepolia') return { name, chainId: 84532, manifestProfile: 'base-sepolia', chainExport: 'baseSepolia' };
  if (name === 'base-mainnet-private') return { name, chainId: 8453, manifestProfile: 'base-mainnet', chainExport: 'base' };
  throw new Error('IROA_OPERATOR_PROFILE must be base-sepolia or base-mainnet-private');
}

function readManifest(profile: ReturnType<typeof selectedProfile>) {
  const path = process.env.IROA_OPERATOR_MANIFEST_PATH;
  if (!path) {
    return {
      configured: false,
      profile: profile.name,
      chainId: profile.chainId,
      manifestHash: null,
      contracts: {
        tokenV1: null,
        nodeRegistry: null,
        rewardDistributor: null,
        tokenV2: null,
        migration: null,
      },
    };
  }
  const input = JSON.parse(readFileSync(resolve(path), 'utf8')) as Record<string, unknown>;
  if (input.profile !== profile.manifestProfile || Number(input.chainId) !== profile.chainId) {
    throw new Error('operator manifest profile or chain does not match the selected build');
  }
  const contracts = input.contracts as Record<string, unknown> | undefined;
  if (!contracts) throw new Error('operator manifest contracts are required');
  const required = ['tokenV1', 'nodeRegistry', 'rewardDistributor'] as const;
  for (const key of required) {
    if (typeof contracts[key] !== 'string' || !ADDRESS.test(contracts[key]) || contracts[key].toLowerCase() === ZERO_ADDRESS) {
      throw new Error(`operator manifest ${key} must be a non-zero address`);
    }
  }
  for (const key of ['tokenV2', 'migration'] as const) {
    if (contracts[key] !== null && contracts[key] !== undefined
      && (typeof contracts[key] !== 'string' || !ADDRESS.test(contracts[key]) || contracts[key].toLowerCase() === ZERO_ADDRESS)) {
      throw new Error(`operator manifest ${key} must be null or a non-zero address`);
    }
  }
  if (typeof input.manifestHash !== 'string' || !HEX32.test(input.manifestHash)) {
    throw new Error('operator manifest hash must be bytes32');
  }
  return {
    configured: true,
    profile: profile.name,
    chainId: profile.chainId,
    manifestHash: input.manifestHash,
    contracts: {
      tokenV1: contracts.tokenV1,
      nodeRegistry: contracts.nodeRegistry,
      rewardDistributor: contracts.rewardDistributor,
      tokenV2: contracts.tokenV2 ?? null,
      migration: contracts.migration ?? null,
    },
  };
}

function operatorProfilePlugin(): Plugin {
  const virtualId = '\0virtual:iroa-operator-profile';
  const profile = selectedProfile();
  const manifest = readManifest(profile);
  return {
    name: 'iroa-operator-profile',
    resolveId(id) {
      return id === 'virtual:iroa-operator-profile' ? virtualId : undefined;
    },
    load(id) {
      if (id !== virtualId) return undefined;
      return [
        `import { ${profile.chainExport} as selectedChain } from 'wagmi/chains';`,
        `export { selectedChain };`,
        `export const operatorProfile = ${JSON.stringify(manifest)};`,
      ].join('\n');
    },
  };
}

export default defineConfig({
  plugins: [react(), operatorProfilePlugin()],
  resolve: {
    alias: {
      '@iroa/protocol': fileURLToPath(new URL('../packages/protocol/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 4175,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: { port: 4175 },
});
