/// <reference types="vite/client" />

declare module 'virtual:iroa-admin-profile' {
  import type { Chain } from 'viem';
  import type { Address, Hex } from 'viem';
  export const selectedChain: Chain;
  export const adminProfile: {
    readonly configured: boolean;
    readonly profile: 'base-sepolia' | 'base-mainnet-private';
    readonly chainId: 84532 | 8453;
    readonly manifestHash: Hex | null;
    readonly contracts: {
      readonly nodeRegistry: Address | null;
      readonly rootRegistry: Address | null;
      readonly timelock: Address | null;
      readonly safe: Address | null;
    };
  };
}

interface ImportMetaEnv {
  readonly VITE_ADMIN_RPC_URL?: string;
  readonly VITE_ADMIN_API_URL?: string;
}
