import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration. The `/api` proxy keeps the dev client talking to the
// Express server workspace on :4000 without CORS.
// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
