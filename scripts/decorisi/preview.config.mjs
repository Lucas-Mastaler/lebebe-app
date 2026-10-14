import { defineConfig } from 'vite'
import path from 'node:path'
export default defineConfig({
  root: path.resolve('scripts/decorisi/preview'),
  resolve: { alias: { '@': path.resolve('src') } },
  esbuild: { jsx: 'automatic' },
  server: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    fs: { allow: [path.resolve('.')] },
  },
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'lucide-react', 'next/link'],
  },
})
