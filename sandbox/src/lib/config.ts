export type SandboxProfile = 'base-sepolia' | 'base-mainnet-private';

const requestedProfile = import.meta.env.VITE_IROA_PROFILE ?? 'base-sepolia';

if (requestedProfile !== 'base-sepolia' && requestedProfile !== 'base-mainnet-private') {
  throw new Error('INVALID_IROA_PROFILE');
}

export const sandboxConfig = {
  profile: requestedProfile as SandboxProfile,
  apiBaseUrl: (import.meta.env.VITE_CONTROL_API_URL ?? '/api').replace(/\/$/, ''),
  networkName: requestedProfile === 'base-mainnet-private' ? 'Base Mainnet' : 'Base Sepolia',
  chainId: requestedProfile === 'base-mainnet-private' ? 8_453 : 84_532,
  policyVersion: '1.0.0',
} as const;
