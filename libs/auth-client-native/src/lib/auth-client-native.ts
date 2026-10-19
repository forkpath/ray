import type { LastLoginMethodClientConfig } from '@better-auth/expo/plugins'
import type { PermissionCheckParams } from '@libs/auth-contract'
import type { BetterAuthClientOptions } from 'better-auth'

import { expoClient } from '@better-auth/expo/client'
import { lastLoginMethodClient } from '@better-auth/expo/plugins'
import {
  adminClient,
  anonymousClient,
  emailOTPClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { ac } from '@libs/auth-contract'

import { resolvePermissionCheckSuccess } from './permission-result'

export { resolvePermissionCheckSuccess } from './permission-result'

export type AuthMobileClientOptions = Parameters<typeof expoClient>[0]
type ExpoClientOptions = AuthMobileClientOptions

const createPlugins = (mobile: ExpoClientOptions, lastLoginMethod: LastLoginMethodClientConfig) => [
  anonymousClient(),
  magicLinkClient(),
  emailOTPClient(),
  twoFactorClient(),
  adminClient(),
  organizationClient({ ac }),
  lastLoginMethodClient(lastLoginMethod),
  expoClient(mobile)
]

export interface AuthNativeClientOptions extends Omit<BetterAuthClientOptions, 'plugins'> {
  mobile: ExpoClientOptions
  lastLoginMethod: LastLoginMethodClientConfig
}

// Better Auth 1.7 does not export the `sessionOptions` type, so an inferred
// spread object cannot be emitted in declarations. Name the client config.
export type AuthNativeClientConfig = Omit<BetterAuthClientOptions, 'plugins'> & {
  plugins: ReturnType<typeof createPlugins>
}

export const createClient = ({ mobile, lastLoginMethod, ...options }: AuthNativeClientOptions) =>
  createAuthClient<AuthNativeClientConfig>({
    ...options,
    plugins: createPlugins(mobile, lastLoginMethod)
  })

export type AuthClient = ReturnType<typeof createClient>

export async function checkPermission(client: AuthClient, permissions: PermissionCheckParams): Promise<boolean> {
  try {
    const permissionClient = client as typeof client & {
      organization: {
        hasPermission(input: { permissions: PermissionCheckParams }): Promise<unknown>
      }
    }
    const result = await permissionClient.organization.hasPermission({ permissions })
    return resolvePermissionCheckSuccess(result)
  } catch {
    return false
  }
}

export function checkRolePermission<R extends string = string>(
  client: AuthClient,
  role: R,
  permissions: PermissionCheckParams
): boolean {
  return client.organization.checkRolePermission({
    role: role as 'owner' | 'admin' | 'member',
    permissions
  })
}
