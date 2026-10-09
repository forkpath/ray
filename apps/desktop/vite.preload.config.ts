import { builtinModules } from 'node:module'
import path from 'node:path'

import { defineConfig } from 'vite'

const external = ['electron', ...builtinModules, ...builtinModules.map(module => `node:${module}`)]

export default defineConfig({
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, 'src')
    }
  },
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/main/preload.ts'),
      formats: ['cjs'],
      // fileName 返回不带扩展名的名称，Vite 会根据 format 添加 .cjs
      fileName: () => 'preload'
    },
    outDir: path.resolve(import.meta.dirname, '.vite/main'),
    emptyOutDir: false,
    rolldownOptions: {
      external,
      output: {
        // 强制使用 .cjs 扩展名
        entryFileNames: 'preload.cjs'
      }
    }
  },
  clearScreen: false
})
