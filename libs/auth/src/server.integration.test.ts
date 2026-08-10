import { createHmac } from 'node:crypto'
import type { AuthEmailSender } from './server-options'

import { testUtils } from 'better-auth/plugins'
import { getTestInstance } from 'better-auth/test'
import { beforeAll, describe, expect, it } from 'vitest'

import { NodeEnv } from '@libs/common'
import { EmailTemplate } from '@libs/email'

import { createAuthBehaviorOptions } from './server-options'
import { UserRole } from './types'

interface CapturedEmail {
  to: string
  template: EmailTemplate
  variables: unknown
}

const capturedEmails: CapturedEmail[] = []

const captureEmail: AuthEmailSender = async ({ to, template, variables }) => {
  capturedEmails.push({
    to,
    template,
    variables
  })
}

const behaviorOptions = createAuthBehaviorOptions({
  nodeEnvironment: NodeEnv.TEST,
  sendEmail: captureEmail,
  socialProviders: {
    google: {
      clientId: 'google-client-id',
      clientSecret: 'google-client-secret'
    },
    github: {
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret'
    },
    apple: {
      clientId: 'apple-client-id',
      clientSecret: 'apple-client-secret',
      appBundleIdentifier: 'com.ray.test'
    }
  }
})

const createTestAuthInstance = () =>
  getTestInstance(
    {
      ...behaviorOptions,
      plugins: [...behaviorOptions.plugins, testUtils({ captureOTP: true })]
    },
    {
      disableTestUser: true
    }
  )

type TestAuthInstance = Awaited<ReturnType<typeof createTestAuthInstance>>

let testAuth: TestAuthInstance

beforeAll(async () => {
  testAuth = await createTestAuthInstance()
})

const findLatestEmail = (to: string, template: EmailTemplate) => {
  let email: CapturedEmail | undefined
  for (let index = capturedEmails.length - 1; index >= 0; index -= 1) {
    const candidate = capturedEmails[index]
    if (candidate?.to === to && candidate.template === template) {
      email = candidate
      break
    }
  }

  if (!email) {
    throw new Error(`Expected ${template} email for ${to}`)
  }

  return email
}

const readEmailVariable = (email: CapturedEmail, key: string) => {
  if (!email.variables || typeof email.variables !== 'object') {
    throw new Error(`Expected variables for ${email.template}`)
  }

  const value = Reflect.get(email.variables, key)
  if (typeof value !== 'string') {
    throw new Error(`Expected string variable ${key} for ${email.template}`)
  }

  return value
}

const signInWithPassword = async (email: string, password: string) => {
  const headers = new Headers()
  const result = await testAuth.client.signIn.email({
    email,
    password,
    fetchOptions: {
      onSuccess: testAuth.cookieSetter(headers)
    }
  })

  if (result.error || !result.data) {
    throw new Error(`Expected password sign-in to succeed for ${email}`)
  }

  return {
    headers,
    result: result.data
  }
}

const postAsUser = async (path: string, headers: Headers, body: Record<string, unknown>) => {
  const requestHeaders = new Headers(headers)
  requestHeaders.set('content-type', 'application/json')
  requestHeaders.set('x-url', 'http://localhost:3000/auth/join')

  return testAuth.customFetchImpl(`http://localhost:3000/api/auth${path}`, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(body)
  })
}

const headersFromResponse = (response: Response) => {
  const headers = new Headers()
  testAuth.cookieSetter(headers)({ response })
  return headers
}

const decodeBase32 = (value: string) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''

  for (const character of value.replace(/=/g, '').toUpperCase()) {
    const index = alphabet.indexOf(character)
    if (index === -1) {
      throw new Error('Invalid base32 TOTP secret')
    }
    bits += index.toString(2).padStart(5, '0')
  }

  const bytes: number[] = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2))
  }

  return Buffer.from(bytes)
}

const createCurrentTotp = (totpUri: string) => {
  const uri = new URL(totpUri)
  const secret = uri.searchParams.get('secret')
  const period = Number(uri.searchParams.get('period') ?? '30')
  const digits = Number(uri.searchParams.get('digits') ?? '6')

  if (!secret) {
    throw new Error('Expected a TOTP secret')
  }

  const counter = Math.floor(Date.now() / 1000 / period)
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))

  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest()
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits

  return binary.toString().padStart(digits, '0')
}

const registerAndVerify = async (email: string, password: string) => {
  const registration = await testAuth.client.signUp.email({
    email,
    name: email.split('@')[0] ?? 'Test user',
    password
  })

  expect(registration.error).toBeNull()
  expect(registration.data?.user.email).toBe(email)

  const verificationEmail = findLatestEmail(email, EmailTemplate.CONFIRM_EMAIL)
  const verificationUrl = readEmailVariable(verificationEmail, 'url')
  const verificationResponse = await testAuth.customFetchImpl(verificationUrl, {
    redirect: 'manual'
  })

  expect([200, 302]).toContain(verificationResponse.status)

  return signInWithPassword(email, password)
}

describe('production Better Auth behavior', () => {
  it('keeps the governed production plugin set in the test instance', () => {
    expect(behaviorOptions.plugins.map(plugin => plugin.id)).toEqual([
      'magic-link',
      'email-otp',
      'passkey',
      'two-factor',
      'anonymous',
      'admin',
      'organization',
      'last-login-method',
      'expo'
    ])
  })

  it('registers, verifies, signs in, creates a session and signs out', async () => {
    const email = 'password-session@example.com'
    const password = 'Password-123456'

    await testAuth.client.signUp.email({
      email,
      name: 'Password session',
      password
    })

    const unverifiedSignIn = await testAuth.client.signIn.email({
      email,
      password
    })
    expect(unverifiedSignIn.error).not.toBeNull()

    const verificationEmail = findLatestEmail(email, EmailTemplate.CONFIRM_EMAIL)
    await testAuth.customFetchImpl(readEmailVariable(verificationEmail, 'url'), {
      redirect: 'manual'
    })

    const { headers } = await signInWithPassword(email, password)
    const session = await testAuth.auth.api.getSession({ headers })

    expect(session?.user.email).toBe(email)
    expect(session?.user.emailVerified).toBe(true)

    await testAuth.client.signOut({
      fetchOptions: {
        headers,
        onSuccess: testAuth.cookieSetter(headers)
      }
    })
    await expect(testAuth.auth.api.getSession({ headers })).resolves.toBeNull()
  })

  it('refreshes an aged session and rejects an expired session', async () => {
    const email = 'session-lifecycle@example.com'
    const { headers } = await registerAndVerify(email, 'SessionLifecycle-123456')
    const initialSession = await testAuth.auth.api.getSession({
      headers,
      query: {
        disableCookieCache: true
      }
    })

    if (!initialSession) {
      throw new Error('Expected an authenticated session')
    }

    await testAuth.db.update({
      model: 'session',
      where: [
        {
          field: 'token',
          value: initialSession.session.token
        }
      ],
      update: {
        expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(0)
      }
    })

    const refreshedSession = await testAuth.auth.api.getSession({
      headers,
      query: {
        disableCookieCache: true
      }
    })
    expect(refreshedSession?.session.updatedAt.getTime()).toBeGreaterThan(0)

    await testAuth.db.update({
      model: 'session',
      where: [
        {
          field: 'token',
          value: initialSession.session.token
        }
      ],
      update: {
        expiresAt: new Date(0)
      }
    })

    await expect(
      testAuth.auth.api.getSession({
        headers,
        query: {
          disableCookieCache: true
        }
      })
    ).resolves.toBeNull()
  })

  it('resets a verified user password through the governed email callback', async () => {
    const email = 'password-reset@example.com'
    const oldPassword = 'OldPassword-123456'
    const newPassword = 'NewPassword-123456'

    await registerAndVerify(email, oldPassword)
    await testAuth.auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: '/auth/password/update'
      }
    })

    const resetEmail = findLatestEmail(email, EmailTemplate.RESET_PASSWORD)
    const resetUrl = new URL(readEmailVariable(resetEmail, 'url'))
    const pathSegments = resetUrl.pathname.split('/')
    const token = pathSegments[pathSegments.length - 1]

    expect(token).toBeTruthy()
    await testAuth.auth.api.resetPassword({
      body: {
        newPassword,
        token
      }
    })

    const { result } = await signInWithPassword(email, newPassword)
    expect(result.user.email).toBe(email)
  })

  it('creates an organization, invites a member and accepts the invitation', async () => {
    const ownerEmail = 'organization-owner@example.com'
    const memberEmail = 'organization-member@example.com'
    const password = 'Organization-123456'
    const owner = await registerAndVerify(ownerEmail, password)
    const member = await registerAndVerify(memberEmail, password)

    const organization = await testAuth.auth.api.createOrganization({
      body: {
        name: 'Ray Test Organization',
        slug: 'ray-test-organization'
      },
      headers: owner.headers
    })

    const invitationResponse = await postAsUser('/organization/invite-member', owner.headers, {
      email: memberEmail,
      organizationId: organization.id,
      role: 'member'
    })
    expect(invitationResponse.ok).toBe(true)

    const invitation: unknown = await invitationResponse.json()
    if (!invitation || typeof invitation !== 'object' || typeof Reflect.get(invitation, 'id') !== 'string') {
      throw new Error('Expected an organization invitation response')
    }
    const invitationId = Reflect.get(invitation, 'id') as string

    expect(findLatestEmail(memberEmail, EmailTemplate.ORGANIZATION_INVITATION)).toBeDefined()

    await testAuth.auth.api.acceptInvitation({
      body: {
        invitationId
      },
      headers: member.headers
    })

    const fullOrganization = await testAuth.auth.api.getFullOrganization({
      query: {
        organizationId: organization.id
      },
      headers: member.headers
    })

    expect(fullOrganization?.members).toHaveLength(2)
    expect(fullOrganization?.members.map(currentMember => currentMember.user.email)).toContain(memberEmail)

    const activeOrganizationResponse = await postAsUser('/organization/set-active', member.headers, {
      organizationId: organization.id
    })
    testAuth.cookieSetter(member.headers)({ response: activeOrganizationResponse })
    await expect(testAuth.auth.api.getSession({ headers: member.headers })).resolves.toMatchObject({
      session: {
        activeOrganizationId: organization.id
      }
    })

    const forbiddenInvitation = await postAsUser('/organization/invite-member', member.headers, {
      email: 'forbidden-invitation@example.com',
      organizationId: organization.id,
      role: 'member'
    })
    expect(forbiddenInvitation.status).toBe(403)
  })

  it('signs in through a magic link and records the governed login method', async () => {
    const email = 'magic-link@example.com'
    await testAuth.auth.api.signInMagicLink({
      body: {
        email,
        name: 'Magic Link',
        callbackURL: '/dashboard'
      },
      headers: new Headers()
    })

    const magicLinkEmail = findLatestEmail(email, EmailTemplate.MAGIC_LINK)
    const response = await testAuth.customFetchImpl(readEmailVariable(magicLinkEmail, 'url'), {
      redirect: 'manual'
    })
    const session = await testAuth.auth.api.getSession({
      headers: headersFromResponse(response)
    })

    expect(session?.user.email).toBe(email)
    expect(session?.user.emailVerified).toBe(true)
  })

  it('signs in through a captured email OTP', async () => {
    const email = 'email-otp@example.com'
    await testAuth.auth.api.sendVerificationOTP({
      body: {
        email,
        type: 'sign-in'
      }
    })

    const otpEmail = findLatestEmail(email, EmailTemplate.SIGN_IN_OTP)
    const response = await postAsUser('/sign-in/email-otp', new Headers(), {
      email,
      name: 'Email OTP',
      otp: readEmailVariable(otpEmail, 'otp')
    })
    const session = await testAuth.auth.api.getSession({
      headers: headersFromResponse(response)
    })

    expect(response.ok).toBe(true)
    expect(session?.user.email).toBe(email)
  })

  it.each([
    ['google', 'accounts.google.com'],
    ['github', 'github.com'],
    ['apple', 'appleid.apple.com']
  ] as const)('starts the %s OAuth flow without contacting the provider', async (provider, expectedHost) => {
    const result = await testAuth.auth.api.signInSocial({
      body: {
        provider,
        callbackURL: 'http://localhost:3000/dashboard'
      },
      headers: new Headers({
        origin: 'http://localhost:3000',
        'user-agent': 'ray-auth-integration-test'
      })
    })

    if (!result.url) {
      throw new Error(`Expected an authorization URL for ${provider}`)
    }
    expect(new URL(result.url).host).toContain(expectedHost)
  })

  it('generates passkey registration and authentication challenges', async () => {
    const { headers } = await registerAndVerify('passkey@example.com', 'Passkey-123456')
    const registration = await testAuth.auth.api.generatePasskeyRegistrationOptions({
      headers
    })
    const authentication = await testAuth.auth.api.generatePasskeyAuthenticationOptions()

    expect(registration.challenge).toBeTruthy()
    expect(registration.user.name).toBe('passkey@example.com')
    expect(authentication.challenge).toBeTruthy()
  })

  it('upgrades an anonymous user and deletes the anonymous identity record', async () => {
    const anonymousResponse = await postAsUser('/sign-in/anonymous', new Headers(), {})
    const anonymousHeaders = headersFromResponse(anonymousResponse)
    const anonymousSession = await testAuth.auth.api.getSession({
      headers: anonymousHeaders
    })

    if (!anonymousSession) {
      throw new Error('Expected an anonymous session')
    }
    expect(anonymousSession?.user.isAnonymous).toBe(true)

    const email = 'anonymous-upgrade@example.com'
    const registration = await testAuth.client.signUp.email({
      email,
      name: 'Upgraded anonymous user',
      password: 'Anonymous-123456',
      fetchOptions: {
        headers: anonymousHeaders,
        onSuccess: testAuth.cookieSetter(anonymousHeaders)
      }
    })

    expect(registration.error).toBeNull()
    expect(registration.data?.user.id).not.toBe(anonymousSession.user.id)
    expect(Reflect.get(registration.data?.user ?? {}, 'isAnonymous')).toBe(false)

    const verificationEmail = findLatestEmail(email, EmailTemplate.CONFIRM_EMAIL)
    const verificationResponse = await testAuth.customFetchImpl(readEmailVariable(verificationEmail, 'url'), {
      headers: anonymousHeaders,
      redirect: 'manual'
    })
    testAuth.cookieSetter(anonymousHeaders)({ response: verificationResponse })

    await expect
      .poll(
        () =>
          testAuth.db.findOne({
            model: 'user',
            where: [
              {
                field: 'id',
                value: anonymousSession.user.id
              }
            ]
          }),
        {
          interval: 10,
          timeout: 1000
        }
      )
      .toBeNull()
  })

  it('enables and verifies TOTP two-factor authentication', async () => {
    const email = 'two-factor@example.com'
    const password = 'TwoFactor-123456'
    const { headers } = await registerAndVerify(email, password)
    const setup = await testAuth.auth.api.enableTwoFactor({
      body: {
        password
      },
      headers
    })

    expect(setup.backupCodes).toHaveLength(10)

    const setupVerification = await postAsUser('/two-factor/verify-totp', headers, {
      code: createCurrentTotp(setup.totpURI)
    })
    testAuth.cookieSetter(headers)({ response: setupVerification })

    expect(setupVerification.ok).toBe(true)
    await expect(testAuth.auth.api.getSession({ headers })).resolves.toMatchObject({
      user: {
        email,
        twoFactorEnabled: true
      }
    })

    await testAuth.client.signOut({
      fetchOptions: {
        headers,
        onSuccess: testAuth.cookieSetter(headers)
      }
    })

    const pendingHeaders = new Headers()
    const signIn = await testAuth.client.signIn.email({
      email,
      password,
      fetchOptions: {
        onSuccess: testAuth.cookieSetter(pendingHeaders)
      }
    })
    expect(Reflect.get(signIn.data ?? {}, 'twoFactorRedirect')).toBe(true)

    const verificationResponse = await postAsUser('/two-factor/verify-totp', pendingHeaders, {
      code: createCurrentTotp(setup.totpURI)
    })
    testAuth.cookieSetter(pendingHeaders)({ response: verificationResponse })

    expect(verificationResponse.ok).toBe(true)
    await expect(testAuth.auth.api.getSession({ headers: pendingHeaders })).resolves.toMatchObject({
      user: {
        email
      }
    })

    await testAuth.client.signOut({
      fetchOptions: {
        headers: pendingHeaders,
        onSuccess: testAuth.cookieSetter(pendingHeaders)
      }
    })

    const backupCode = setup.backupCodes[0]
    if (!backupCode) {
      throw new Error('Expected a two-factor backup code')
    }

    const backupHeaders = new Headers()
    await testAuth.client.signIn.email({
      email,
      password,
      fetchOptions: {
        onSuccess: testAuth.cookieSetter(backupHeaders)
      }
    })
    const backupResponse = await postAsUser('/two-factor/verify-backup-code', backupHeaders, {
      code: backupCode
    })
    testAuth.cookieSetter(backupHeaders)({ response: backupResponse })

    expect(backupResponse.ok).toBe(true)
    await expect(testAuth.auth.api.getSession({ headers: backupHeaders })).resolves.toMatchObject({
      user: {
        email
      }
    })
  })

  it('allows an admin to ban, unban and impersonate a user', async () => {
    const context = await testAuth.auth.$context
    const admin = context.test.createUser({
      email: 'admin@example.com',
      emailVerified: true,
      role: UserRole.ADMIN
    })
    const target = context.test.createUser({
      email: 'admin-target@example.com',
      emailVerified: true
    })

    await context.test.saveUser(admin)
    await context.test.saveUser(target)
    const adminLogin = await context.test.login({ userId: admin.id })

    const banned = await testAuth.auth.api.banUser({
      body: {
        userId: target.id,
        banReason: 'integration-test'
      },
      headers: adminLogin.headers
    })
    expect(banned.user.banned).toBe(true)

    const unbanned = await testAuth.auth.api.unbanUser({
      body: {
        userId: target.id
      },
      headers: adminLogin.headers
    })
    expect(unbanned.user.banned).toBe(false)

    const impersonated = await testAuth.auth.api.impersonateUser({
      body: {
        userId: target.id
      },
      headers: adminLogin.headers
    })
    expect(impersonated.user.id).toBe(target.id)
    expect(Reflect.get(impersonated.session, 'impersonatedBy')).toBe(admin.id)
  })
})
