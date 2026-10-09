import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'

import { createClient } from '@libs/api-client'
import { APP_SLUG, Platform } from '@libs/common'

import { mobileEnv } from '~/lib/env'

function normalizeOrigin(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '')
  return trimmed.replace(/\/api\/v1$/, '')
}

export const getBaseUrl = () => {
  if (__DEV__) {
    const debuggerHost = Constants.expoConfig?.hostUri
    const localhost = debuggerHost?.split(':')[0]
    if (localhost) {
      return normalizeOrigin(`http://${localhost}:8000`)
    }
  }
  return normalizeOrigin(mobileEnv.apiBaseUrl)
}

/** Engine REST 前缀（Nest `globalPrefix` = api/v1） */
export const getApiBaseUrl = () => `${getBaseUrl()}/api/v1`

const AUTH_TOKEN_KEY = `${APP_SLUG}-mobile.auth-token`

export const api = createClient({
  runtime: Platform.MOBILE,
  baseURL: getApiBaseUrl(),
  withCredentials: false,
  headers: {
    'x-client-platform': Platform.MOBILE
  },
  auth: {
    getAccessToken: async () => {
      try {
        const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY)
        return token ?? undefined
      } catch {
        return undefined
      }
    }
  }
})
