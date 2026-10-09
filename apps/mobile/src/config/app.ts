import { mobileEnv } from '~/lib/env'

export const appConfig = {
  locale: mobileEnv.defaultLocale,
  url: mobileEnv.siteUrl,
  theme: mobileEnv.theme
} as const
