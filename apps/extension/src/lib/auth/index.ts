import { appConfig } from '~/config/app'

import { createClient } from '@libs/auth-web'
import { Platform } from '@libs/common'

export const authClient = createClient({
  baseURL: appConfig.apiBaseUrl,
  fetchOptions: {
    credentials: 'include',
    headers: {
      'x-client-platform': Platform.EXTENSION
    },
    throw: true
  }
})
