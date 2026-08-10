import type { ReactNode } from 'react'

import { useEffect } from 'react'

import { Platform } from 'react-native'
import Purchases, { LOG_LEVEL } from 'react-native-purchases'

import { mobileEnv } from '../env'

interface ProviderProps {
  children: ReactNode
  locale?: string
}

export const RevenueCatProvider = ({ children, locale }: ProviderProps) => {
  useEffect(() => {
    if (__DEV__) {
      void Purchases.setLogLevel(LOG_LEVEL.DEBUG)
    }

    const apiKey = Platform.select({
      ios: mobileEnv.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
      android: mobileEnv.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
    })

    if (!apiKey) {
      return
    }

    Purchases.configure({ apiKey })
    if (locale) {
      const purchases = Purchases as unknown as {
        overridePreferredLocale?: (value: string | null) => void
      }
      purchases.overridePreferredLocale?.(locale)
    }
  }, [])

  useEffect(() => {
    const purchases = Purchases as unknown as {
      overridePreferredLocale?: (value: string | null) => void
    }
    purchases.overridePreferredLocale?.(locale ?? null)
  }, [locale])

  return <>{children}</>
}
