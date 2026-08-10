import type { auth } from '../server'
import type { AuthClientOptions, AuthMobileClientOptions } from '../types'
import type { LastLoginMethodClientConfig } from '@better-auth/expo/plugins'
import type { PermissionCheckParams, RoleName } from '@libs/auth-contract'
import type { BetterAuthClientPlugin } from 'better-auth'

import { expoClient } from '@better-auth/expo/client'
import { lastLoginMethodClient } from '@better-auth/expo/plugins'
import {
  adminClient,
  anonymousClient,
  emailOTPClient,
  inferAdditionalFields,
  magicLinkClient,
  organizationClient,
  twoFactorClient
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { ac } from '@libs/auth-contract'

import { resolvePermissionCheckSuccess } from './permission-result'

const createExpoClientPlugin = (options: AuthMobileClientOptions) => {
  const plugin = expoClient(options)
  // Expo 1.6.26 narrows BetterFetch's generic defaults; adapt that boundary
  // without widening the complete plugin tuple used for endpoint inference.
  const getActions: NonNullable<BetterAuthClientPlugin['getActions']> = ($fetch, $store) =>
    plugin.getActions($fetch as Parameters<typeof plugin.getActions>[0], $store)

  return {
    ...plugin,
    getActions
  }
}

export const createClient = ({
  mobile,
  lastLoginMethod,
  ...options
}: AuthClientOptions & {
  mobile: AuthMobileClientOptions
  lastLoginMethod: LastLoginMethodClientConfig
}) => {
  const client = createAuthClient({
    ...options,
    plugins: [
      anonymousClient(),
      magicLinkClient(),
      emailOTPClient(),
      twoFactorClient(),
      adminClient(),
      organizationClient({
        ac
      }),
      lastLoginMethodClient(lastLoginMethod),
      inferAdditionalFields<typeof auth>(),
      createExpoClientPlugin(mobile)
    ]
  })

  return client
}

/**
 * 权限检查工具类型
 * 用于移动端权限检查的辅助类型
 */
export type AuthClient = ReturnType<typeof createClient>

/**
 * 检查当前用户是否拥有指定权限
 * 需要用户已登录且在某个组织中
 *
 * @example
 * ```ts
 * const client = createClient({ baseURL: '/api/auth', mobile: {...}, lastLoginMethod: {...} })
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
 * const client = createClient({ baseURL: '/api/auth', mobile: {...}, lastLoginMethod: {...} })
 * const canDelete = checkRolePermission(client, 'admin', { product: ['delete'] })
 * ```
 */
export function checkRolePermission(client: AuthClient, role: RoleName, permissions: PermissionCheckParams): boolean {
  return client.organization.checkRolePermission({
    role,
    permissions
  })
}
