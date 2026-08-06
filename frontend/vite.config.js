import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: [
      'customer.127.0.0.1.nip.io',
      'engineer.127.0.0.1.nip.io',
    ],
  },
  build: {
    target: 'es2020',
    manifest: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router/')) return 'vendor-react';
          if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
