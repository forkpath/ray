import type { Mutation, Query, QueryClient } from '@tanstack/react-query'

import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryCache,
  QueryClient as TanStackQueryClient
} from '@tanstack/react-query'

import { ApiError, ApiNetworkError } from '@libs/api-core'

// 与 QueryCache/MutationCache 全局 onError 回调的参数类型一致
type AnyQuery = Query<unknown, unknown, unknown>
type AnyMutation = Mutation<unknown, unknown, unknown>

/**
 * Query 错误回调参数
 */
export interface QueryErrorContext {
  /** 失败的 Query 实例，可通过 query.queryKey、query.meta 等做过滤 */
  query: AnyQuery
}

/**
 * Mutation 错误回调参数
 */
export interface MutationErrorContext {
  /** 失败的 Mutation 实例 */
  mutation: AnyMutation
  /** Mutation 的 variables */
  variables: unknown
}

export interface QueryClientOptions {
  /**
   * 默认 staleTime（毫秒）
   * @default 60000 (1 minute)
   */
  staleTime?: number

  /**
   * 默认 gcTime（毫秒）
   * @default 300000 (5 minutes)
   */
  gcTime?: number

  /**
   * Query 全局错误处理器
   * 通过 QueryCache.onError 实现，每个 query 失败时都会触发
   *
   * @param error - 错误对象
   * @param context.query - 失败的 Query 实例，可用于按 queryKey/meta 过滤
   */
  onQueryError?: (error: unknown, context: QueryErrorContext) => void

  /**
   * Mutation 全局错误处理器
   * 通过 MutationCache.onError 实现，每个 mutation 失败时都会触发
   *
   * @param error - 错误对象
   * @param context.mutation - 失败的 Mutation 实例
   * @param context.variables - Mutation 的 variables
   */
  onMutationError?: (error: unknown, context: MutationErrorContext) => void
}

/**
 * 默认错误消息提取
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof ApiNetworkError) {
    return '网络连接失败，请检查网络后重试'
  }
  if (error instanceof Error) {
    return error.message
  }
  return '发生未知错误'
}

/**
 * 创建 QueryClient 实例
 *
 * @example
 * ```ts
 * // 基础用法
 * const queryClient = createQueryClient()
 *
 * // 自定义配置（带全局错误处理）
 * const queryClient = createQueryClient({
 *   staleTime: 30000,
 *   onQueryError: (error, query) => {
 *     // 可根据 query.queryKey 或 query.meta 过滤
 *     if (!query.meta?.suppressError) {
 *       console.error('Query failed:', error)
 *     }
 *   },
 *   onMutationError: (error) => toast.error(getErrorMessage(error))
 * })
 * ```
 */
export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  const { staleTime = 60_000, gcTime = 300_000, onQueryError, onMutationError } = options

  return new TanStackQueryClient({
    queryCache: onQueryError
      ? new QueryCache({
          onError: (error, query) => onQueryError(error, { query })
        })
      : undefined,
    mutationCache: onMutationError
      ? new MutationCache({
          onError: (error, variables, _context, mutation) => onMutationError(error, { mutation, variables })
        })
      : undefined,
    defaultOptions: {
      queries: {
        // SSR 友好：避免客户端立即重新请求
        staleTime,
        gcTime,
        // 网络错误时不自动重试
        retry: (failureCount, error) => {
          if (error instanceof ApiNetworkError) {
            return failureCount < 3
          }
          // 业务错误不重试
          if (error instanceof ApiError) {
            return false
          }
          return failureCount < 1
        }
      },
      dehydrate: {
        // SSR dehydration：包含 pending 状态的 query
        shouldDehydrateQuery: query => defaultShouldDehydrateQuery(query) || query.state.status === 'pending'
      }
    }
  })
}

// 单例模式（用于客户端）
let clientQueryClient: QueryClient | undefined

/**
 * 获取 QueryClient 实例（单例模式）
 *
 * - Server: 每次请求创建新实例
 * - Browser: 使用单例
 */
export function getQueryClient(options?: QueryClientOptions): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return createQueryClient(options)
  }
  // Browser: use singleton pattern
  return (clientQueryClient ??= createQueryClient(options))
}
