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
        strictExecutionOrder: true,
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router)/, entriesAware: true },
            { name: 'vendor-motion', test: /node_modules[\\/]framer-motion/, entriesAware: true },
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react/, entriesAware: true },
            { name: 'vendor-markdown', test: /node_modules[\\/](react-markdown|remark-|rehype-)/, entriesAware: true },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
