import type { KeyLike } from 'jose'

import { exportJWK, generateKeyPair, importJWK, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { OrgTokenError, verifyOrganizationToken } from '../jwt'

const ISSUER = 'http://localhost:3001/oidc'
const ORG_ID = 'org_acme'

let privateKey: KeyLike
let publicKey: KeyLike

async function signOrgToken(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'ES256' })
    .setIssuer(ISSUER)
    .setSubject((claims.sub as string) ?? 'user_1')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)
}

beforeAll(async () => {
  const kp = await generateKeyPair('ES256')
  privateKey = kp.privateKey
  // 模拟"从 JWKS 取公钥"：导出再导入，确保只用公钥验签
  publicKey = (await importJWK(await exportJWK(kp.publicKey), 'ES256')) as KeyLike
})

describe('verifyOrganizationToken', () => {
  it('verifies a valid org token and maps the session', async () => {
    const token = await signOrgToken({
      sub: 'user_1',
      aud: `urn:logto:organization:${ORG_ID}`,
      scope: 'access:crm access:dashboard',
      roles: ['developer']
    })

    const session = await verifyOrganizationToken(token, publicKey, {
      issuer: ISSUER,
      expectedOrganizationId: ORG_ID,
      requiredScopes: ['access:crm']
    })

    expect(session).toEqual({
      userId: 'user_1',
      organizationId: ORG_ID,
      scopes: ['access:crm', 'access:dashboard'],
      roles: ['developer']
    })
  })

  it('rejects a token with no organization audience', async () => {
    const token = await signOrgToken({ sub: 'user_1', aud: 'https://api.example.com', scope: 'access:crm' })
    await expect(verifyOrganizationToken(token, publicKey, { issuer: ISSUER })).rejects.toMatchObject({
      code: 'NO_ORG_AUDIENCE'
    })
  })

  it('rejects when org id does not match expected', async () => {
    const token = await signOrgToken({ sub: 'u', aud: `urn:logto:organization:other`, scope: '' })
    await expect(
      verifyOrganizationToken(token, publicKey, { issuer: ISSUER, expectedOrganizationId: ORG_ID })
    ).rejects.toMatchObject({ code: 'ORG_MISMATCH' })
  })

  it('rejects when required scope missing', async () => {
    const token = await signOrgToken({
      sub: 'u',
      aud: `urn:logto:organization:${ORG_ID}`,
      scope: 'access:dashboard'
    })
    await expect(
      verifyOrganizationToken(token, publicKey, { issuer: ISSUER, requiredScopes: ['access:billing'] })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_SCOPE' })
  })

  it('rejects a token with a bad signature', async () => {
    const other = await generateKeyPair('ES256')
    const token = await new SignJWT({ sub: 'u', aud: `urn:logto:organization:${ORG_ID}` })
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer(ISSUER)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(other.privateKey)
    await expect(verifyOrganizationToken(token, publicKey, { issuer: ISSUER })).rejects.toBeInstanceOf(OrgTokenError)
  })
})
