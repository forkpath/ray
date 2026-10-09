import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

import { unitCoverage } from '../../scripts/testing/unit-coverage.mjs'

export default defineConfig(() => ({
  root: import.meta.dirname,
  envDir: false,
  cacheDir: '../../node_modules/.vite/services/pulse',
  plugins: [
    tsconfigPaths({
      root: import.meta.dirname,
      envDir: false,
      projects: ['../../tsconfig.base.json', './tsconfig.app.json']
    })
  ],
  test: {
    name: 'pulse',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default', 'junit'],
    outputFile: { junit: '../../dist/test-results/pulse/unit/junit.xml' },
    coverage: unitCoverage('services/pulse')
  }
}))
