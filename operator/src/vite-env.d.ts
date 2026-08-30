/// <reference types="vite/client" />

declare module 'virtual:iroa-operator-profile' {
  import type { Chain } from 'viem';
  import type { Address, Hex } from 'viem';

  export const selectedChain: Chain;
  export const operatorProfile: {
    readonly configured: boolean;
    readonly profile: 'base-sepolia' | 'base-mainnet-private';
    readonly chainId: 84532 | 8453;
    readonly manifestHash: Hex | null;
    readonly contracts: {
      readonly tokenV1: Address | null;
      readonly nodeRegistry: Address | null;
      readonly rewardDistributor: Address | null;
      readonly tokenV2: Address | null;
      readonly migration: Address | null;
    };
  };
}

interface ImportMetaEnv {
  readonly VITE_CONTROL_API_URL?: string;
  readonly VITE_OPERATOR_RPC_URL?: string;
}
