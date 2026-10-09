import { builtinModules } from 'node:module'
import path from 'node:path'

import { defineConfig, loadEnv } from 'vite'

const external = [
  'electron',
  'electron-updater',
  '@sentry/electron/main',
  ...builtinModules,
  ...builtinModules.map(module => `node:${module}`)
]

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, 'src')
    }
  },
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/main/main.ts'),
      formats: ['cjs'],
      fileName: () => 'main.cjs'
    },
    outDir: path.resolve(import.meta.dirname, '.vite/main'),
    emptyOutDir: true,
    rolldownOptions: {
      external
    }
  },
  define: Object.fromEntries(
    ['VITE_SENTRY_DESKTOP_DSN', 'VITE_SENTRY_ENVIRONMENT'].map(key => [
      `process.env.${key}`,
      JSON.stringify(process.env[key] ?? loadEnv(mode, path.resolve(import.meta.dirname, '../..'), 'VITE_')[key] ?? '')
    ])
  ),
  // do not remove logs when HMR
  clearScreen: false
}))
