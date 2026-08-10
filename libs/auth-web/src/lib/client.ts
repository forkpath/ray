import type { PermissionCheckParams, RoleName } from '@libs/auth-contract'
import type { BetterAuthClientOptions } from 'better-auth'
import type { Invitation, Member, Organization } from 'better-auth/client/plugins'

import { passkeyClient } from '@better-auth/passkey/client'
import {
  adminClient,
  anonymousClient,
  lastLoginMethodClient,
  magicLinkClient,
  organizationClient,
  twoFactorClient
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

import { ac } from '@libs/auth-contract'

import { resolvePermissionCheckSuccess } from './permission-result'

type AuthWebClientOptions = Omit<BetterAuthClientOptions, 'plugins'>

/** React client for browser and Electron renderer runtimes. */
export const createClient = (options?: AuthWebClientOptions) =>
  createAuthClient({
    ...options,
    plugins: [
      passkeyClient(),
      anonymousClient(),
      magicLinkClient(),
      twoFactorClient(),
      adminClient(),
      organizationClient({ ac }),
      lastLoginMethodClient()
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

export type { ActiveOrganization, AuthClient, AuthWebClientOptions, Invitation, Member, Organization, Session, User }
