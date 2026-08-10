import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/ui-web',
  plugins: [react()],
  resolve: {
    alias: {
      '@libs/ui-core': resolve(__dirname, '../ui-core/src/index.ts')
    }
  },
  test: {
    name: 'ui-web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/ui-web',
      provider: 'v8' as const
    }
  }
}))
