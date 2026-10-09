import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

import { unitCoverage } from '../../scripts/testing/unit-coverage.mjs'

export default defineConfig(() => ({
  root: import.meta.dirname,
  envDir: false,
  cacheDir: '../../node_modules/.vite/services/worker',
  plugins: [
    tsconfigPaths({
      root: import.meta.dirname,
      envDir: false,
      projects: ['../../tsconfig.base.json', './tsconfig.app.json']
    })
  ],
  test: {
    name: 'worker',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default', 'junit'],
    outputFile: { junit: '../../dist/test-results/worker/unit/junit.xml' },
    coverage: unitCoverage('services/worker')
  }
}))
