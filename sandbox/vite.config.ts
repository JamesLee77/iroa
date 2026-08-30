import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@iroa/protocol': fileURLToPath(new URL('../packages/protocol/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 4174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: { port: 4174 },
});
