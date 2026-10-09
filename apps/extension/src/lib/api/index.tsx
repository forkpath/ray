import { createClient } from '@libs/api-client'
import { Platform } from '@libs/common'

import { appConfig } from '~/config/app'
import { getAuthCookieHeader } from '~/lib/auth-cookie'

// engine 的业务接口有全局前缀 /api/v1（见 services/engine/src/main.ts 的 setGlobalPrefix）。
// better-auth 走 authClient 不经过该前缀；其他业务 API 都要带 /api/v1。
export const apiClient = createClient({
  baseURL: `${appConfig.apiBaseUrl}/api/v1`,
  headers: {
    'x-client-platform': Platform.EXTENSION
  }
})

// ⚠️ 关键 boilerplate —— 勿删。
// background service worker 调用本 apiClient 时，Chrome 不会自动携带登录 cookie
// （SW 无浏览上下文，SameSite=Lax cookie 按跨站丢弃）。这里统一注入，使 apiClient
// 在 popup / background 任意上下文都能带上登录态。详细原理见 ~/lib/auth-cookie.ts。
// 在 popup 等页面上下文里这次注入是冗余的，但无害（chrome.cookies 调用毫秒级）。
apiClient.interceptors.request.use(async config => {
  const cookieHeader = await getAuthCookieHeader()
  if (cookieHeader) {
    config.headers.set('Cookie', cookieHeader)
  }
  return config
})
