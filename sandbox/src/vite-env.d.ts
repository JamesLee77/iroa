/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTROL_API_URL?: string;
  readonly VITE_IROA_PROFILE?: 'base-sepolia' | 'base-mainnet-private';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
