import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      // Lets the development Practice page use the local judge server without
      // needing a browser-facing URL. Production may instead set VITE_JUDGE_API_URL.
      '/api': { target: process.env.VITE_JUDGE_API_URL || 'http://localhost:4000', changeOrigin: true },
    },
  },
});
