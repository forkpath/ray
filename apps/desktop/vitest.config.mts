import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

import { unitCoverage } from '../../scripts/testing/unit-coverage.mjs'

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tsconfigPaths({ projects: ['../../tsconfig.base.json', './tsconfig.json'] })],
  test: {
    name: 'desktop',
    watch: false,
    reporters: ['default', 'json'],
    outputFile: { json: '../../dist/desktop/test-results/unit.json' },
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'tests/**/*.spec.mjs'],
    coverage: unitCoverage('apps/desktop')
  }
})
