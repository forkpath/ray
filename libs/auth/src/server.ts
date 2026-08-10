import { prismaAdapter } from 'better-auth/adapters/prisma'
import { betterAuth } from 'better-auth/minimal'

import { sendEmail } from '@libs/email/server'
import { prisma } from '@libs/pg-dao'

import { env } from './env'
import { createAuthBehaviorOptions } from './server-options'

export const auth = betterAuth({
  ...createAuthBehaviorOptions({
    betterAuthUrl: env.BETTER_AUTH_URL || undefined,
    nodeEnvironment: env.NODE_ENV,
    sendEmail,
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET
      },
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET
      },
      apple: {
        clientId: env.AUTH_APPLE_CLIENT_ID,
        clientSecret: env.AUTH_APPLE_CLIENT_SECRET,
        appBundleIdentifier: env.AUTH_APPLE_APP_BUNDLE_IDENTIFIER
      }
    }
  }),
  baseURL: env.BETTER_AUTH_URL || undefined,
  basePath: '/api/auth',
  database: prismaAdapter(prisma, { provider: 'postgresql' })
})

export type AuthErrorCode = keyof typeof auth.$ERROR_CODES
export type Session = typeof auth.$Infer.Session
export type User = Session['user']
export type Invitation = typeof auth.$Infer.Invitation
export type Organization = typeof auth.$Infer.Organization
export type ActiveOrganization = typeof auth.$Infer.ActiveOrganization
export type Member = typeof auth.$Infer.Member
