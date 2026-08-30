import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(new URL('./e2e/fixtures/operator-manifest.json', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4315',
    locale: 'ko-KR',
    colorScheme: 'light',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 4315',
    url: 'http://127.0.0.1:4315/nodes',
    reuseExistingServer: false,
    env: {
      IROA_OPERATOR_PROFILE: 'base-sepolia',
      IROA_OPERATOR_MANIFEST_PATH: manifestPath,
      VITE_OPERATOR_RPC_URL: 'http://127.0.0.1:4315/rpc',
    },
  },
});
