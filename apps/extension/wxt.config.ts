import { fileURLToPath } from 'url'

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import svgr from 'vite-plugin-svgr'
import { defineConfig } from 'wxt'

const extensionRoot = fileURLToPath(new URL('./', import.meta.url))
const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url))
const srcRoot = fileURLToPath(new URL('./src', import.meta.url))

const getWxtMode = () => {
  const explicitMode = process.env.MODE ?? process.env.NODE_ENV
  if (explicitMode) return explicitMode

  const argv = process.argv.join(' ')
  return /\b(build|zip)\b/.test(argv) ? 'production' : 'development'
}

const loadExtensionEnv = (mode: string) => {
  // 应用目录优先，根目录兜底：
  // 1. apps/extension/.env.* 适合 extension 自己维护的环境变量
  // 2. monorepo 根目录 .env.* 作为共享默认值
  const workspaceEnv = loadEnv(mode, workspaceRoot, '')
  const extensionEnv = loadEnv(mode, extensionRoot, '')

  return {
    ...workspaceEnv,
    ...extensionEnv
  }
}

Object.assign(process.env, loadExtensionEnv(getWxtMode()))

export default defineConfig({
  manifest: async () => {
    const mode = getWxtMode()
    const env = loadExtensionEnv(mode)
    const isDev = mode === 'development'

    const appConfig = {
      name: env.VITE_PRODUCT_NAME,
      apiBaseUrl: env.VITE_API_BASE_URL,
      url: env.VITE_URL
    }

    // 开发环境使用 <all_urls> 方便调试；
    // 生产构建从 env 中的 API / 站点地址派生最小权限，降低商店审核风险
    const hostPermissions: string[] = isDev
      ? ['<all_urls>']
      : [`${new URL(appConfig.apiBaseUrl).origin}/*`, `${new URL(appConfig.url).origin}/*`]

    return {
      name: appConfig.name,
      permissions: ['storage', 'cookies', 'sidePanel', 'contextMenus', 'downloads'],
      host_permissions: hostPermissions
    }
  },
  dev: {
    server: {
      // WXT 开发服务器端口，供 popup/options 等页面做 HMR
      port: 1234
    }
  },
  webExt: {
    // 关闭 web-ext 自动拉起浏览器和自动临时安装扩展
    // 当前仓库采用“手动在浏览器中加载 build 目录”的调试方式
    disabled: true
  },
  // WXT 源码目录
  srcDir: 'src',
  // WXT 入口点目录，包含 background/popup/content 等
  entrypointsDir: 'app',
  // 扩展构建输出目录
  outDir: 'build',
  // 启用 React 支持和自动图标生成
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  // 关闭 WXT 自动导入，避免和 monorepo 里的显式导入习惯冲突
  imports: false,
  vite: () => ({
    // 复用 monorepo 的路径别名、Tailwind 和 SVG React 组件能力
    plugins: [
      nxViteTsPaths(),
      tailwindcss(),
      svgr({
        svgrOptions: {
          exportType: 'default',
          ref: true,
          svgo: true,
          titleProp: true
        }
      })
    ],
    optimizeDeps: {
      // 避免把构建产物目录误参与依赖预构建
      exclude: ['*/build']
    },
    resolve: {
      // 保证整个扩展运行时只使用一份 React，避免 hooks/context 异常
      dedupe: ['react', 'react-dom']
    },
    define: {
      // 向扩展代码注入可序列化的环境变量，并过滤掉不适合暴露的 path
      'process.env': Object.fromEntries(Object.entries(import.meta.env).filter(([key]) => key.toLowerCase() !== 'path'))
    },
    alias: {
      // 统一使用 ~/ 指向扩展 src 根目录
      '~': srcRoot
    }
  })
})
