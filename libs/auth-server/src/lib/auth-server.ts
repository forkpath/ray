import { expo } from '@better-auth/expo'
import { passkey } from '@better-auth/passkey'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { betterAuth } from 'better-auth/minimal'
import { admin, anonymous, emailOTP, lastLoginMethod, magicLink, organization, twoFactor } from 'better-auth/plugins'

import { ac, AuthProvider, getUrl, roles, SocialProvider, VerificationType } from '@libs/auth-contract'
import { APP_NAME, APP_SLUG, NodeEnv } from '@libs/common'
import { EmailTemplate } from '@libs/email'
import { sendEmail } from '@libs/email-server'
import { getLocaleFromRequest } from '@libs/i18n'
import { prisma } from '@libs/pg-dao'

import { env } from './env'

export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: env.BETTER_AUTH_URL || undefined,
  basePath: '/api/auth',
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes
    }
  },
  user: {
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url }, request) =>
        sendEmail({
          to: user.email,
          template: EmailTemplate.DELETE_ACCOUNT,
          locale: getLocaleFromRequest(request),
          variables: {
            url: getUrl({
              request,
              url,
              type: VerificationType.DELETE_ACCOUNT
            }).toString()
          }
        })
    },
    changeEmail: {
      enabled: true,
      updateEmailWithoutVerification: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }, request) =>
        sendEmail({
          to: user.email,
          template: EmailTemplate.CHANGE_EMAIL,
          locale: getLocaleFromRequest(request),
          variables: {
            url: getUrl({
              request,
              url,
              type: VerificationType.CONFIRM_EMAIL
            }).toString(),
            newEmail
          }
        })
    }
  },
  trustedOrigins: [
    'chrome-extension://',
    'ray://', // 基于Expo开发的mobile需要使用这个scheme
    ...(env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL.toString()] : []),
    ...(env.NODE_ENV === NodeEnv.DEVELOPMENT ? ['http://localhost*', 'https://localhost*'] : [])
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }, request) =>
      sendEmail({
        to: user.email,
        template: EmailTemplate.RESET_PASSWORD,
        locale: getLocaleFromRequest(request),
        variables: {
          url
        }
      })
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) =>
      sendEmail({
        to: user.email,
        template: EmailTemplate.CONFIRM_EMAIL,
        locale: getLocaleFromRequest(request),
        variables: {
          url: getUrl({
            request,
            url,
            type: VerificationType.CONFIRM_EMAIL
          }).toString()
        }
      })
  },
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }, ctx) =>
        sendEmail({
          to: email,
          template: EmailTemplate.MAGIC_LINK,
          locale: getLocaleFromRequest(ctx?.request),
          variables: {
            url: getUrl({
              request: ctx?.request,
              url,
              type: VerificationType.MAGIC_LINK
            }).toString()
          }
        })
    }),
    emailOTP({
      sendVerificationOTP: async ({ email, otp }, ctx) =>
        sendEmail({
          to: email,
          template: EmailTemplate.SIGN_IN_OTP,
          locale: getLocaleFromRequest(ctx?.request),
          variables: { otp }
        })
    }),
    passkey(),
    twoFactor(),
    anonymous(),
    admin(),
    organization({
      ac,
      roles,
      dynamicAccessControl: {
        enabled: true
      },
      sendInvitationEmail: async ({ invitation, inviter, organization }, request) => {
        const url = getUrl({
          request
        })
        url.searchParams.set('invitationId', invitation.id)
        url.searchParams.set('email', invitation.email)

        return sendEmail({
          to: invitation.email,
          template: EmailTemplate.ORGANIZATION_INVITATION,
          locale: getLocaleFromRequest(request),
          variables: {
            url: url.toString(),
            inviter: inviter.user.name,
            organization: organization.name
          }
        })
      }
    }),
    lastLoginMethod({
      customResolveMethod: ctx => {
        switch (ctx.path) {
          case '/magic-link/verify':
            return AuthProvider.MAGIC_LINK
          case '/sign-in/email-otp':
            return AuthProvider.EMAIL_OTP
          case '/passkey/verify-authentication':
            return AuthProvider.PASSKEY
          default:
            return null
        }
      }
    }),
    expo()
  ],
  socialProviders: {
    [SocialProvider.GOOGLE]: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET
    },
    [SocialProvider.GITHUB]: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET
    },
    [SocialProvider.APPLE]: {
      clientId: env.AUTH_APPLE_CLIENT_ID,
      clientSecret: env.AUTH_APPLE_CLIENT_SECRET,
      appBundleIdentifier: env.AUTH_APPLE_APP_BUNDLE_IDENTIFIER
    }
  },
  advanced: {
    cookiePrefix: APP_SLUG,
    cookies: {
      state: {
        attributes: {
          sameSite: 'none',
          secure: true
        }
      }
    }
  },
  logger: {
    log: (level, ...args) => {
      const fn =
        level === 'error'
          ? console.error
          : level in console
            ? console[level as 'debug' | 'info' | 'warn' | 'log']
            : console.log
      fn(...args)
    }
  }
})

export type AuthErrorCode = keyof typeof auth.$ERROR_CODES
export type Session = typeof auth.$Infer.Session
export type User = Session['user']
export type Invitation = typeof auth.$Infer.Invitation
export type Organization = typeof auth.$Infer.Organization
export type ActiveOrganization = typeof auth.$Infer.ActiveOrganization
export type Member = typeof auth.$Infer.Member
