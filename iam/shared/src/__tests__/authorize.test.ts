import type { KeyLike } from 'jose'

import { generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { authorizeRequest, AuthzError, extractBearer } from '../authorize'

const ISSUER = 'http://localhost:3001/oidc'
const ORG = 'org_acme'
let priv: KeyLike
let pub: KeyLike

async function token(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT({ aud: `urn:logto:organization:${ORG}`, ...claims })
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(ISSUER)
    .setSubject((claims.sub as string) ?? 'u1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(priv)
}

beforeAll(async () => {
  const kp = await generateKeyPair('ES256')
  priv = kp.privateKey
  pub = kp.publicKey
})

describe('extractBearer', () => {
  it('parses bearer token', () => {
    expect(extractBearer('Bearer abc')).toBe('abc')
    expect(extractBearer('abc')).toBeNull()
    expect(extractBearer(null)).toBeNull()
  })
})

describe('authorizeRequest', () => {
  const cfg = () => ({ issuer: ISSUER, getKey: pub })

  it('allows public routes without a token', async () => {
    expect(await authorizeRequest(null, { public: true }, cfg())).toBeNull()
  })

  it('401 when token missing on protected route', async () => {
    await expect(authorizeRequest(null, {}, cfg())).rejects.toMatchObject({ status: 401 })
  })

  it('allows optional auth without token', async () => {
    expect(await authorizeRequest(null, { optional: true }, cfg())).toBeNull()
  })

  it('maps a valid token to a compat session', async () => {
    const t = await token({ sub: 'u1', scope: 'access:crm', roles: ['developer'] })
    const session = await authorizeRequest(`Bearer ${t}`, {}, cfg())
    expect(session).toEqual({
      user: { id: 'u1', roles: ['developer'] },
      organizationId: ORG,
      scopes: ['access:crm']
    })
  })

  it('403 when required scope is missing', async () => {
    const t = await token({ sub: 'u1', scope: 'access:dashboard' })
    await expect(authorizeRequest(`Bearer ${t}`, { requiredScopes: ['access:billing'] }, cfg())).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN'
    })
  })

  it('403 when required role not held', async () => {
    const t = await token({ sub: 'u1', scope: 'access:crm', roles: ['analyst'] })
    await expect(authorizeRequest(`Bearer ${t}`, { requiredRoles: ['org-admin'] }, cfg())).rejects.toBeInstanceOf(
      AuthzError
    )
  })

  it('allows when one required role matches', async () => {
    const t = await token({ sub: 'u1', scope: 'access:crm', roles: ['analyst', 'developer'] })
    const session = await authorizeRequest(`Bearer ${t}`, { requiredRoles: ['developer'] }, cfg())
    expect(session?.user.id).toBe('u1')
  })

  it('401 on invalid signature', async () => {
    const other = await generateKeyPair('ES256')
    const bad = await new SignJWT({ aud: `urn:logto:organization:${ORG}` })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(other.privateKey)
    await expect(authorizeRequest(`Bearer ${bad}`, {}, cfg())).rejects.toMatchObject({ status: 401 })
  })
})
