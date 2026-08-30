import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

type AdminProfileName = 'base-sepolia' | 'base-mainnet-private';
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function selectedProfile() {
  const name = process.env.IROA_ADMIN_PROFILE ?? 'base-sepolia';
  if (name === 'base-sepolia') return { name: name as AdminProfileName, chainId: 84532 as const, manifestProfile: 'base-sepolia', chainExport: 'baseSepolia' };
  if (name === 'base-mainnet-private') return { name: name as AdminProfileName, chainId: 8453 as const, manifestProfile: 'base-mainnet', chainExport: 'base' };
  throw new Error('IROA_ADMIN_PROFILE must be base-sepolia or base-mainnet-private');
}

function readManifest(profile: ReturnType<typeof selectedProfile>) {
  const path = process.env.IROA_ADMIN_MANIFEST_PATH;
  if (!path) {
    return {
      configured: false,
      profile: profile.name,
      chainId: profile.chainId,
      manifestHash: null,
      contracts: { nodeRegistry: null, rootRegistry: null, timelock: null, safe: null },
    };
  }
  const input = JSON.parse(readFileSync(resolve(path), 'utf8')) as Record<string, unknown>;
  if (input.profile !== profile.manifestProfile || Number(input.chainId) !== profile.chainId) {
    throw new Error('admin manifest profile or chain does not match the selected build');
  }
  const contracts = input.contracts as Record<string, unknown> | undefined;
  if (!contracts) throw new Error('admin manifest contracts are required');
  for (const key of ['nodeRegistry', 'rootRegistry', 'timelock', 'safe'] as const) {
    if (typeof contracts[key] !== 'string' || !ADDRESS.test(contracts[key]) || contracts[key].toLowerCase() === ZERO_ADDRESS) {
      throw new Error(`admin manifest ${key} must be a non-zero address`);
    }
  }
  if (typeof input.manifestHash !== 'string' || !HEX32.test(input.manifestHash)) {
    throw new Error('admin manifest hash must be bytes32');
  }
  return {
    configured: true,
    profile: profile.name,
    chainId: profile.chainId,
    manifestHash: input.manifestHash,
    contracts: {
      nodeRegistry: contracts.nodeRegistry,
      rootRegistry: contracts.rootRegistry,
      timelock: contracts.timelock,
      safe: contracts.safe,
    },
  };
}

function adminProfilePlugin(): Plugin {
  const virtualId = '\0virtual:iroa-admin-profile';
  const profile = selectedProfile();
  const manifest = readManifest(profile);
  return {
    name: 'iroa-admin-profile',
    resolveId(id) { return id === 'virtual:iroa-admin-profile' ? virtualId : undefined; },
    load(id) {
      if (id !== virtualId) return undefined;
      return [
        `import { ${profile.chainExport} as selectedChain } from 'wagmi/chains';`,
        'export { selectedChain };',
        `export const adminProfile = ${JSON.stringify(manifest)};`,
      ].join('\n');
    },
  };
}

export default defineConfig({
  plugins: [react(), adminProfilePlugin()],
  server: {
    port: 4176,
    proxy: {
      '/control': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/control/, ''),
      },
    },
  },
  preview: { port: 4176 },
});
