import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { adminProfile, selectedChain } from 'virtual:iroa-admin-profile';

if (selectedChain.id !== adminProfile.chainId) throw new Error('WAGMI_PROFILE_CHAIN_MISMATCH');

export const wagmiConfig = createConfig({
  chains: [selectedChain],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [selectedChain.id]: http(import.meta.env.VITE_ADMIN_RPC_URL) },
});

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } },
});

export { adminProfile, selectedChain };
