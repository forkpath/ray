import { ThemeColor, ThemeMode } from '@libs/ui-core'

type ThemeModeValue = (typeof ThemeMode)[keyof typeof ThemeMode]
type ThemeColorValue = (typeof ThemeColor)[keyof typeof ThemeColor]

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue
  return value === 'true' || value === '1'
}

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed.includes(value as T) ? (value as T) : fallback) as T
}

export const mobileEnv = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000',
  siteUrl: process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  defaultLocale: process.env.EXPO_PUBLIC_DEFAULT_LOCALE ?? 'zh',

  theme: {
    mode: parseEnum<ThemeModeValue>(
      process.env.EXPO_PUBLIC_THEME_MODE as ThemeModeValue | undefined,
      Object.values(ThemeMode) as ThemeModeValue[],
      ThemeMode.SYSTEM as ThemeModeValue
    ),
    color: parseEnum<ThemeColorValue>(
      process.env.EXPO_PUBLIC_THEME_COLOR as ThemeColorValue | undefined,
      Object.values(ThemeColor) as ThemeColorValue[],
      ThemeColor.ORANGE as ThemeColorValue
    )
  },

  auth: {
    password: parseBool(process.env.EXPO_PUBLIC_AUTH_PASSWORD, true),
    magicLink: parseBool(process.env.EXPO_PUBLIC_AUTH_MAGIC_LINK, false),
    emailOtp: parseBool(process.env.EXPO_PUBLIC_AUTH_EMAIL_OTP, false),
    anonymous: parseBool(process.env.EXPO_PUBLIC_AUTH_ANONYMOUS, true),
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? ''
  },

  revenuecat: {
    iosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ?? '',
    androidApiKey:
      process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ?? ''
  },

  analytics: {
    posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '',
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    mixpanelToken: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN ?? ''
  },

  monitoring: {
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
    sentryEnv: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development'
  }
} as const
