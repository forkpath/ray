import { createClient } from '@libs/auth-client-web'
import { Platform } from '@libs/common'

import { appConfig } from '~/config/app'

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
