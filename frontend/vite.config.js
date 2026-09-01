import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

const buildTarget = process.env.SAGEMRO_BUILD_TARGET === 'portal' ? 'portal' : 'public'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __SAGEMRO_BUILD_TARGET__: JSON.stringify(buildTarget),
  },
  server: {
    allowedHosts: [
      'customer.127.0.0.1.nip.io',
      'engineer.127.0.0.1.nip.io',
    ],
  },
  build: {
    outDir: buildTarget === 'portal' ? 'dist-portal' : 'dist',
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
