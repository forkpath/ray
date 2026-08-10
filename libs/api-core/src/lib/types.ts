import type { AxiosAdapter, AxiosRequestConfig } from 'axios'

export interface WrappedResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

export interface ApiRequestMeta {
  /**
   * 跳过统一响应解包（用于 better-auth 等非 wrap 格式）
   */
  skipWrap?: boolean
  /**
   * 返回原始 AxiosResponse
   */
  raw?: boolean
}

declare module 'axios' {
  interface AxiosRequestConfig {
    api?: ApiRequestMeta
  }
}

export interface ApiRequestConfig<D = unknown> extends AxiosRequestConfig<D> {
  api?: ApiRequestMeta
}

export interface AuthHeaderProvider {
  /**
   * 返回当前请求的鉴权 token（如果走 cookie 可返回空）
   */
  getAccessToken?: () => string | undefined | Promise<string | undefined>
  /**
   * 默认为 Authorization
   */
  headerName?: string
  /**
   * token 为空时是否仍写入 header（默认 false）
   */
  alwaysSetHeader?: boolean
  /**
   * 对 token 进行格式化（默认加 Bearer 前缀）
   */
  format?: (token: string) => string
}

export interface ApiCoreOptions {
  baseURL: string
  timeout?: number
  /**
   * 允许跨域携带 cookie（better-auth 需要）
   */
  withCredentials?: boolean
  /**
   * axios adapter 适配（例如在不同 runtime 下替换）
   */
  adapter?: AxiosAdapter
  /**
   * 额外 headers
   */
  headers?: Record<string, string>
  /**
   * better-auth 的基础路径（用于跳过 wrap）
   */
  authBasePath?: string
  /**
   * 鉴权 header 获取逻辑（可选）
   */
  auth?: AuthHeaderProvider
}
