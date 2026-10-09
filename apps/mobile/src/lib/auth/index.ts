import * as Linking from 'expo-linking'
import * as SecureStore from 'expo-secure-store'

import { createClient } from '@libs/auth-client-native'
import { APP_SLUG, Platform } from '@libs/common'
import { config as i18nConfig } from '@libs/i18n'

import { getBaseUrl } from '~/lib/api'
import { useI18nConfig } from '~/lib/providers/i18n'

export const authClient = createClient({
  baseURL: getBaseUrl(),
  fetchOptions: {
    headers: {
      'x-client-platform': Platform.MOBILE,
      origin: Linking.createURL('')
    },
    throw: true,
    onRequest: ctx => {
      const locale = `${i18nConfig.cookie}=${useI18nConfig.getState().config.locale}`
      if (ctx.headers instanceof Headers) {
        const cookie = ctx.headers.get('cookie')
        ctx.headers.set('cookie', `${locale}${cookie ? `; ${cookie}` : ''}`)
      }
      return ctx
    }
  },
  mobile: {
    storage: SecureStore,
    // 与 `libs/auth` 服务端 `advanced.cookiePrefix` 共享同一个 @libs/common 常量，
    // 否则 `expo` 插件在 `hasBetterAuthCookies` 中不会把 Set-Cookie 写入 SecureStore，
    // useSession 会永远为 null
    cookiePrefix: APP_SLUG
  },
  lastLoginMethod: {
    storage: SecureStore
  }
})
