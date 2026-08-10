import type { PermissionCheckParams, RoleName } from '../permissions'
import type { auth } from '../server'
import type { AuthClientOptions } from '../types'

import { passkeyClient } from '@better-auth/passkey/client'
import {
  adminClient,
  anonymousClient,
  inferAdditionalFields,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

/**
 * React 客户端 - 用于组件内的 useSession 等 hooks
 */

import { ac } from '../permissions'
import { resolvePermissionCheckSuccess } from './permission-result'

export const createClient = (options?: AuthClientOptions) => {
  const client = createAuthClient({
    ...options,
    plugins: [
      passkeyClient(),
      anonymousClient(),
      magicLinkClient(),
      twoFactorClient(),
      adminClient(),
      organizationClient({
        ac
      }),
      lastLoginMethodClient(),
      inferAdditionalFields<typeof auth>()
    ]
  })

  return client
}

/**
 * 权限检查工具类型
 * 用于客户端权限检查的辅助类型
 */
export type AuthClient = ReturnType<typeof createClient>

/**
 * 检查当前用户是否拥有指定权限
 * 需要用户已登录且在某个组织中
 *
 * @example
 * ```ts
 * const client = createClient({ baseURL: '/api/auth' })
 * const canCreate = await checkPermission(client, { product: ['create'] })
 * ```
 */
export async function checkPermission(client: AuthClient, permissions: PermissionCheckParams): Promise<boolean> {
  try {
    const result = await client.organization.hasPermission({
      permissions
    })
    return resolvePermissionCheckSuccess(result)
  } catch {
    // 客户端权限检查用于 UI 展示；网络/会话异常时默认按无权限处理。
    return false
  }
}

/**
 * 同步检查角色是否拥有指定权限
 * 不会发起网络请求，仅基于预定义角色进行检查
 * 注意：此方法不支持动态角色
 *
 * @example
 * ```ts
 * const client = createClient({ baseURL: '/api/auth' })
 * const canDelete = checkRolePermission(client, 'admin', { product: ['delete'] })
 * ```
 */
export function checkRolePermission(client: AuthClient, role: RoleName, permissions: PermissionCheckParams): boolean {
  return client.organization.checkRolePermission({
    role,
    permissions
  })
}
