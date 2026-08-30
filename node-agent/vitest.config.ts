import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@iroa/protocol': fileURLToPath(new URL('../packages/protocol/src/index.ts', import.meta.url)),
      '@iroa/crypto': fileURLToPath(new URL('../packages/crypto/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
