export type IroaChainId = 8453 | 84532;

export type IroaChain = {
  id: IroaChainId;
  key: 'base' | 'base-sepolia';
  name: string;
  rpcEnv: 'BASE_MAINNET_RPC_URL' | 'BASE_SEPOLIA_RPC_URL';
  blockExplorerUrl: string;
};

export const IROA_CHAINS = {
  base: {
    id: 8453,
    key: 'base',
    name: 'Base Mainnet',
    rpcEnv: 'BASE_MAINNET_RPC_URL',
    blockExplorerUrl: 'https://basescan.org',
  },
  baseSepolia: {
    id: 84532,
    key: 'base-sepolia',
    name: 'Base Sepolia',
    rpcEnv: 'BASE_SEPOLIA_RPC_URL',
    blockExplorerUrl: 'https://sepolia.basescan.org',
  },
} as const satisfies Record<string, IroaChain>;

export function iroaChainById(chainId: number): IroaChain {
  const chain = Object.values(IROA_CHAINS).find((candidate) => candidate.id === chainId);
  if (!chain) {
    throw new Error(`Unsupported IROA chain ${chainId}`);
  }
  return chain;
}
