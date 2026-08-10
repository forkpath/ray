import { createClient } from '@libs/auth-web'
import { ExecutionSide, Platform } from '@libs/common'

// 在开发和预览环境中，如果需要直接连接到后端服务，可以设置 VITE_API_BASE_URL
const baseURL = import.meta.env?.VITE_API_ENDPOINT as string | undefined

/**
 * Auth 客户端
 *
 * getSession() 返回结构：
 * - 未登录: null
 * - 已登录: { session: {...}, user: {...} }
 *
 * 在 beforeLoad 中使用时：
 * const session = await authClient.getSession()
 * if (session?.user) { ... }
 */
export const authClient = createClient({
  baseURL,
  fetchOptions: {
    credentials: 'include', // 跨域请求时携带 cookie
    headers: {
      'x-client-platform': `${Platform.WEB}-${ExecutionSide.CLIENT}`
    },
    throw: true
  }
})
