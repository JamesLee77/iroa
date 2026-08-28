import { defineConfig, devices } from '@playwright/test';

const previewPort = Number(process.env.IROA_PREVIEW_PORT ?? 4391);
const previewURL = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: 'line',
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: previewURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `ASTRO_PREVIEW_BACKGROUND=1 npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
    url: previewURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
