/**
 * The public network state reads one signed deployment manifest from
 * `onchain/deployments/`. The manifest is the single source for the chain,
 * the contract addresses, and the release the site may describe; the site
 * never carries an address of its own.
 *
 * Profile precedence: a mainnet manifest wins, otherwise the Base Sepolia
 * manifest is shown as validation data (owner decision 2026-09-06), and the
 * local profile is never published.
 */

export type PublicProfile = 'base-sepolia' | 'base-mainnet';

export interface PublicDeployment {
  profile: PublicProfile;
  chainId: 84532 | 8453;
  release: string;
  createdAt: string;
  contracts: {
    nodeRegistry: string;
    receiptRootRegistry: string;
    rewardDistributor: string;
  };
  explorer: string;
  /** Public JSON-RPC endpoint the page polls (owner decision Q3: the Base public RPC). */
  rpcUrl: string;
  /** Block the contracts were deployed at, when the manifest's `controls` record it. */
  deploymentBlock?: bigint;
}

export type NetworkSource = { kind: 'none' } | { kind: 'deployment'; deployment: PublicDeployment };

const EXPLORERS: Record<PublicProfile, string> = {
  'base-sepolia': 'https://sepolia.basescan.org',
  'base-mainnet': 'https://basescan.org',
};

const RPC_URLS: Record<PublicProfile, string> = {
  'base-sepolia': 'https://sepolia.base.org',
  'base-mainnet': 'https://mainnet.base.org',
};

const CHAIN_IDS: Record<PublicProfile, 84532 | 8453> = {
  'base-sepolia': 84532,
  'base-mainnet': 8453,
};

const isAddress = (value: unknown): value is string => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Reads the fields the site needs from one manifest. A manifest that lacks any
 * of them is rejected loudly: a half-described deployment must not render as
 * a live network.
 */
export function readPublicDeployment(profile: PublicProfile, manifest: unknown): PublicDeployment {
  if (!isRecord(manifest)) throw new Error(`deployment manifest for ${profile} is not an object`);
  if (manifest.profile !== profile) {
    throw new Error(`deployment manifest for ${profile} declares profile ${String(manifest.profile)}`);
  }
  if (String(manifest.chainId) !== String(CHAIN_IDS[profile])) {
    throw new Error(`deployment manifest for ${profile} declares chainId ${String(manifest.chainId)}`);
  }
  if (typeof manifest.release !== 'string' || typeof manifest.createdAt !== 'string') {
    throw new Error(`deployment manifest for ${profile} lacks release or createdAt`);
  }
  const contracts = manifest.contracts;
  if (!isRecord(contracts)) throw new Error(`deployment manifest for ${profile} lacks contracts`);
  // The deploy script names the receipt-root registry `rootRegistry`; older drafts used the
  // contract's full name. Either spelling is accepted, the first one found wins.
  const receiptRootRegistry = contracts.rootRegistry ?? contracts.receiptRootRegistry;
  if (!isAddress(contracts.nodeRegistry)) throw new Error(`deployment manifest for ${profile} lacks a nodeRegistry address`);
  if (!isAddress(receiptRootRegistry)) throw new Error(`deployment manifest for ${profile} lacks a rootRegistry address`);
  if (!isAddress(contracts.rewardDistributor)) throw new Error(`deployment manifest for ${profile} lacks a rewardDistributor address`);
  const controls = isRecord(manifest.controls) ? manifest.controls : {};
  const deploymentBlockText = controls.deploymentBlock;
  if (deploymentBlockText !== undefined && !(typeof deploymentBlockText === 'string' && /^\d+$/.test(deploymentBlockText))) {
    throw new Error(`deployment manifest for ${profile} carries a non-numeric deploymentBlock`);
  }
  return {
    profile,
    chainId: CHAIN_IDS[profile],
    release: manifest.release,
    createdAt: manifest.createdAt,
    contracts: {
      nodeRegistry: contracts.nodeRegistry,
      receiptRootRegistry,
      rewardDistributor: contracts.rewardDistributor,
    },
    explorer: EXPLORERS[profile],
    rpcUrl: RPC_URLS[profile],
    ...(deploymentBlockText === undefined ? {} : { deploymentBlock: BigInt(deploymentBlockText) }),
  };
}

/**
 * Picks the manifest the site publishes from the files under
 * `onchain/deployments/`, keyed by the path the deploy scripts write:
 * `<profile>/v1.json` for the V1 release. A V2 migration manifest does not
 * replace it — the node registry and root registry are the same contracts.
 */
export function selectNetworkSource(manifests: Readonly<Record<string, unknown>>): NetworkSource {
  for (const profile of ['base-mainnet', 'base-sepolia'] as const) {
    const manifest = manifests[`${profile}/v1.json`];
    if (manifest !== undefined) return { kind: 'deployment', deployment: readPublicDeployment(profile, manifest) };
  }
  return { kind: 'none' };
}

const manifestFiles = import.meta.glob('../../../onchain/deployments/*/v1.json', { eager: true, import: 'default' });

/** The network source resolved at build time from the repository's manifests. */
export const NETWORK_SOURCE: NetworkSource = selectNetworkSource(
  Object.fromEntries(
    Object.entries(manifestFiles).map(([path, manifest]) => [path.split('/').slice(-2).join('/'), manifest]),
  ),
);
