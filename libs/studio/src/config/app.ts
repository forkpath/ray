import type { ThemeColor, ThemeMode } from '@libs/ui-core'

import { APP_NAME } from '@libs/common'

// 默认配置，用于 env 未加载或验证失败时
const defaults = {
  url: 'http://localhost:3000',
  locale: 'en',
  theme: {
    mode: 'system' as ThemeMode,
    color: 'orange' as ThemeColor
  }
} as const

// 尝试从 import.meta.env 读取 Vite 环境变量
function getViteEnv<T>(key: string, fallback: T): T {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const value = import.meta.env[key]
    if (value !== undefined) return value as T
  }
  return fallback
}

export const appConfig = {
  name: APP_NAME,
  url: getViteEnv('VITE_URL', defaults.url),
  locale: getViteEnv('VITE_DEFAULT_LOCALE', defaults.locale),
  theme: {
    mode: getViteEnv('VITE_THEME_MODE', defaults.theme.mode) as ThemeMode,
    color: getViteEnv('VITE_THEME_COLOR', defaults.theme.color) as ThemeColor
  }
} as const
