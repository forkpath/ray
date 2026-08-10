import type { Preset } from 'envin/types'

import { defineEnv } from 'envin'
import * as z from 'zod'

import { Locale } from './types'

export const preset = {
  id: 'i18n',
  clientPrefix: 'VITE_',
  client: {
    VITE_DEFAULT_LOCALE: z.string().optional().default(Locale.EN)
  },
  server: {
    DEFAULT_LOCALE: z.string().optional()
  }
} as const satisfies Preset

// 安全获取环境变量，支持 Node.js 和浏览器环境
function getEnvVar(key: string): string | undefined {
  // Node.js 环境
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  // 浏览器/Vite 环境
  const browserEnv = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env
  if (browserEnv) {
    const value = browserEnv[key]
    return typeof value === 'string' ? value : undefined
  }
  return undefined
}

export const env = defineEnv({
  ...preset,
  env: {
    DEFAULT_LOCALE: getEnvVar('DEFAULT_LOCALE'),
    VITE_DEFAULT_LOCALE: getEnvVar('VITE_DEFAULT_LOCALE')
  }
})
