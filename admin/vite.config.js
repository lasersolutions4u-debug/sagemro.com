import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    allowedHosts: ['admin.127.0.0.1.nip.io'],
    proxy: {
      '/api': {
        target: 'https://sagemro-api.lasersolutions4u.workers.dev',
        changeOrigin: true,
      },
    },
  },
});
