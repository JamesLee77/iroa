import { baseSepolia as selectedChain } from 'wagmi/chains';

export { selectedChain };
export const adminProfile = {
  configured: true,
  profile: 'base-sepolia' as const,
  chainId: 84532 as const,
  manifestHash: `0x${'aa'.repeat(32)}` as const,
  contracts: {
    nodeRegistry: '0x1000000000000000000000000000000000000001' as const,
    rootRegistry: '0x1000000000000000000000000000000000000002' as const,
    timelock: '0x1000000000000000000000000000000000000003' as const,
    safe: '0x1000000000000000000000000000000000000004' as const,
  },
};
