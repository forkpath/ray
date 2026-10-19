import type { PermissionCheckParams } from '@libs/auth-contract'
import type { BetterAuthClientOptions } from 'better-auth'

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

const createPlugins = () => [
  passkeyClient(),
  anonymousClient(),
  magicLinkClient(),
  twoFactorClient(),
  adminClient(),
  organizationClient({ ac }),
  lastLoginMethodClient()
]

export type AuthWebClientOptions = Omit<BetterAuthClientOptions, 'plugins'>

// Better Auth 1.7 does not export the `sessionOptions` type, so an inferred
// spread object cannot be emitted in declarations. Name the client config.
export type AuthWebClientConfig = AuthWebClientOptions & { plugins: ReturnType<typeof createPlugins> }

export const createClient = (options?: AuthWebClientOptions) =>
  createAuthClient<AuthWebClientConfig>({
    ...options,
    plugins: createPlugins()
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

export const resolvePermissionCheckSuccess = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (!value || typeof value !== 'object') return false

  const parsed = value as { success?: unknown; data?: { success?: unknown } }
  if (typeof parsed.success === 'boolean') return parsed.success
  if (typeof parsed.data?.success === 'boolean') return parsed.data.success
  return false
}
