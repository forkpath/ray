import { browser } from 'wxt/browser'

import { APP_SLUG } from '@libs/common'

import { appConfig } from '~/config/app'

/**
 * ⚠️ 浏览器扩展开发中一个极易被忽略的坑 —— background service worker 拿不到登录 cookie。
 *
 * 背景知识：
 * better-auth 的 session cookie 默认 SameSite=Lax。Chrome 对带 host_permissions 的
 * extension fetch 会做"first-party 化"处理，但这只在【页面上下文】成立：
 *
 *   ┌─────────────────────────┬──────────────────────────────────────────────┐
 *   │ popup / options / tabs   │ 真实文档上下文 → Lax cookie 自动携带 ✅        │
 *   │ background service worker│ 无顶层浏览上下文，site-for-cookies 为 null    │
 *   │                          │ → Lax/Strict cookie 一律按跨站丢弃 ❌          │
 *   └─────────────────────────┴──────────────────────────────────────────────┘
 *
 * 后果：popup 里 authClient.useSession() 一切正常，让你以为登录态没问题；
 * 可一旦在 background（右键菜单、alarms、消息处理等）里调用需要鉴权的 API，
 * 请求就不带 cookie → 401 → 你会困惑"明明登录了为什么拿不到数据"。
 *
 * 解决方式：在 background 调用的 HTTP client 上，手动用 cookies API 读取 web 域
 * 已写入的 cookie 注入到 Cookie 请求头。本文件提供该能力，并已接入 ~/lib/api 的
 * apiClient（见 lib/api/index.tsx 的 interceptor）。因此你无需关心 —— 直接用
 * apiClient 即可，无论在 popup 还是 background 都能带上登录态。
 *
 * 使用 WXT 的 `wxt/browser` 统一命名空间，在 Chrome / Firefox / Safari 上行为一致。
 * 前置条件：'cookies' permission + host_permissions 覆盖 web URL（见 wxt.config.ts）。
 */

const COOKIE_PREFIX = APP_SLUG // 与 libs/auth-server/src/lib/auth-server.ts 的 cookiePrefix 同源

/**
 * 读取浏览器中已写入的所有 better-auth cookies，序列化为标准 Cookie 请求头格式。
 * 用户未登录或 cookies API 不可用时返回空串。
 */
export async function getAuthCookieHeader(): Promise<string> {
  if (!browser?.cookies) return ''

  try {
    const cookies = await browser.cookies.getAll({ url: appConfig.url })
    const authCookies = cookies.filter(c => c.name.startsWith(`${COOKIE_PREFIX}.`))
    return authCookies.map(c => `${c.name}=${c.value}`).join('; ')
  } catch {
    return ''
  }
}
