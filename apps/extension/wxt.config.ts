import { fileURLToPath } from 'url'
import type { UserConfig } from 'wxt'

import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import svgr from 'vite-plugin-svgr'
import { defineConfig } from 'wxt'

// config 文件在构建前由 WXT 加载器执行，不解析 tsconfig 的 @libs/* 别名。
// brand.ts 是零依赖叶子模块，用相对路径直引最安全，不会牵连 barrel 的传递依赖。
// eslint-disable-next-line @nx/enforce-module-boundaries
import { APP_NAME } from '../../libs/common/src/constants/brand'

const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url))
const srcRoot = fileURLToPath(new URL('./src', import.meta.url))

const getWxtMode = () => {
  const explicitMode = process.env.MODE ?? process.env.NODE_ENV
  if (explicitMode) return explicitMode

  const argv = process.argv.join(' ')
  return /\b(build|zip)\b/.test(argv) ? 'production' : 'development'
}

/**
 * 单根 .env 策略：环境变量统一放在 monorepo 根目录的唯一 .env 中。
 * 因为不存在多个 .env.* 文件，所以没有"谁覆盖谁"的优先级问题，
 * 直接用 Vite 的 loadEnv 从根目录加载即可（prefix 传 '' 表示加载全部变量）。
 *
 * extension 自身目录不放 .env —— 仅根目录一处，便于维护。
 */
const loadRootEnv = (mode: string) => loadEnv(mode, workspaceRoot, '')

const publicUrl = (name: 'VITE_API_BASE_URL' | 'VITE_URL', value: string | undefined) => {
  if (value) return value
  if (process.env.CI === 'true') return `https://${name.toLowerCase().replaceAll('_', '-')}.invalid`

  throw new Error(`${name} is required to build the extension`)
}

Object.assign(process.env, loadRootEnv(getWxtMode()))

// WXT 0.20.20 still declares Vite 7 plugin types while this workspace is on
// Vite 8. Keep the incompatibility at the config boundary until WXT updates
// its peer range; WXT still validates the returned object at runtime.
export default defineConfig({
  manifest: async () => {
    const mode = getWxtMode()
    const env = loadRootEnv(mode)
    const isDev = mode === 'development'

    const appConfig = {
      name: APP_NAME,
      apiBaseUrl: publicUrl('VITE_API_BASE_URL', env.VITE_API_BASE_URL),
      url: publicUrl('VITE_URL', env.VITE_URL)
    }

    // 开发环境使用 <all_urls> 方便调试；
    // 生产构建从 env 中的 API / 站点地址派生最小权限，降低商店审核风险
    const hostPermissions: string[] = isDev
      ? ['<all_urls>']
      : [`${new URL(appConfig.apiBaseUrl).origin}/*`, `${new URL(appConfig.url).origin}/*`]

    return {
      name: appConfig.name,
      permissions: ['storage', 'cookies', 'sidePanel'],
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
      tsconfigPaths: true,
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
} as UserConfig)
