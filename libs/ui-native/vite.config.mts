import { resolve } from 'node:path'

import { defineConfig } from 'vite'

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/ui-native',
  resolve: {
    alias: {
      '@libs/ui-core': resolve(__dirname, '../ui-core/src/index.ts')
    }
  },
  test: {
    name: 'ui-native',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/libs/ui-native',
      provider: 'v8' as const
    }
  }
}))
