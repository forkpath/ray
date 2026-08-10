import type { expoClient } from '@better-auth/expo/client'
import type { BetterAuthClientOptions, BetterAuthClientPlugin } from 'better-auth'

export * from '@libs/auth-contract'

type AuthMobileClientOptions = Parameters<typeof expoClient>[0]
// Plugin composition is owned here so Better Auth can infer the exact endpoint tuple.
type AuthClientOptions = Omit<BetterAuthClientOptions, 'plugins'>

export type { AuthClientOptions, BetterAuthClientPlugin as AuthClientPlugin, AuthMobileClientOptions }

export type { User, Session, Invitation, Organization, ActiveOrganization, Member } from './server'
