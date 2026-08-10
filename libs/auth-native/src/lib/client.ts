import type { LastLoginMethodClientConfig } from '@better-auth/expo/plugins'
import type { PermissionCheckParams, RoleName } from '@libs/auth-contract'
import type { BetterAuthClientOptions, BetterAuthClientPlugin } from 'better-auth'
import type { Invitation, Member, Organization } from 'better-auth/client/plugins'

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

type AuthMobileClientOptions = Parameters<typeof expoClient>[0]
type AuthNativeClientOptions = Omit<BetterAuthClientOptions, 'plugins'> & {
  mobile: AuthMobileClientOptions
  lastLoginMethod: LastLoginMethodClientConfig
}

const createExpoClientPlugin = (options: AuthMobileClientOptions) => {
  const plugin = expoClient(options)
  const getActions: NonNullable<BetterAuthClientPlugin['getActions']> = ($fetch, $store) =>
    plugin.getActions($fetch as Parameters<typeof plugin.getActions>[0], $store)

  return {
    ...plugin,
    getActions
  }
}

/** React client for Expo and React Native runtimes. */
export const createClient = ({ mobile, lastLoginMethod, ...options }: AuthNativeClientOptions) =>
  createAuthClient({
    ...options,
    plugins: [
      anonymousClient(),
      magicLinkClient(),
      emailOTPClient(),
      twoFactorClient(),
      adminClient(),
      organizationClient({ ac }),
      lastLoginMethodClient(lastLoginMethod),
      createExpoClientPlugin(mobile)
    ]
  })

type AuthClient = ReturnType<typeof createClient>
type Session = AuthClient['$Infer']['Session']
type User = Session['user']
type ActiveOrganization = AuthClient['$Infer']['ActiveOrganization']

export async function checkPermission(client: AuthClient, permissions: PermissionCheckParams): Promise<boolean> {
  try {
    const result = await client.organization.hasPermission({ permissions })
    return resolvePermissionCheckSuccess(result)
  } catch {
    return false
  }
}

export function checkRolePermission(client: AuthClient, role: RoleName, permissions: PermissionCheckParams): boolean {
  return client.organization.checkRolePermission({ role, permissions })
}

export type {
  ActiveOrganization,
  AuthClient,
  AuthMobileClientOptions,
  AuthNativeClientOptions,
  Invitation,
  Member,
  Organization,
  Session,
  User
}
