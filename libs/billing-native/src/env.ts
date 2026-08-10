import type { Preset } from 'envin/types'

import { defineEnv } from 'envin'
import * as z from 'zod'

const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }

  const expoEnv =
    typeof import.meta !== 'undefined'
      ? (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      : undefined

  return expoEnv?.[key]
}

export const mobilePreset = {
  id: 'billing-native',
  clientPrefix: 'EXPO_PUBLIC_',
  client: {
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: z.string().optional(),
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY: z.string().optional(),
    EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY: z.string().optional(),
    EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY: z.string().optional()
  }
} as const satisfies Preset

export const mobileEnv = defineEnv({
  ...mobilePreset,
  env: {
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:
      getEnvVar('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY') ?? getEnvVar('EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY'),
    EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:
      getEnvVar('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY') ?? getEnvVar('EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY'),
    EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY: getEnvVar('EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY'),
    EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY: getEnvVar('EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY')
  }
})
