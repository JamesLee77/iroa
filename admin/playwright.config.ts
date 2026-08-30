import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(new URL('./e2e/fixtures/admin-manifest.json', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4316', locale: 'ko-KR', colorScheme: 'light', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --port 4316',
    url: 'http://127.0.0.1:4316/nodes',
    reuseExistingServer: false,
    env: {
      IROA_ADMIN_PROFILE: 'base-sepolia',
      IROA_ADMIN_MANIFEST_PATH: manifestPath,
      VITE_ADMIN_RPC_URL: 'http://127.0.0.1:4316/rpc',
    },
  },
});
