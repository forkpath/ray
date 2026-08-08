import type { JWTVerifyGetKey, KeyLike } from 'jose'

import { jwtVerify } from 'jose'

/**
 * Logto 组织 token（JWT）校验。
 *
 * 这是身份层与子系统的唯一连接点（ADR-0001）。子系统/引擎据此确认：
 * 「这个用户是谁、属于哪个组织、粗粒度 scope 是否允许访问」。
 *
 * 设计为注入式 key 解析（JWTVerifyGetKey），生产用 createRemoteJWKSet，
 * 测试用本地签名 + 本地公钥，无需联网。
 */

const ORG_AUD_PREFIX = 'urn:logto:organization:'

export interface OrgSession {
  /** 用户 id（token sub） */
  userId: string
  /** 组织 id（从 aud 解析） */
  organizationId: string
  /** 粗粒度 scope（子系统访问白名单） */
  scopes: string[]
  /** 组织角色名（若 token 配置了 roles 自定义 claim，否则为空） */
  roles: string[]
}

export interface VerifyOrgTokenOptions {
  issuer: string
  /** 期望的组织 id；提供时强制校验 token 的 org 与之一致 */
  expectedOrganizationId?: string
  /** 访问所需的粗粒度 scope；token 必须全部包含 */
  requiredScopes?: string[]
}

export class OrgTokenError extends Error {
  constructor(
    public readonly code: 'INVALID_TOKEN' | 'NO_ORG_AUDIENCE' | 'ORG_MISMATCH' | 'INSUFFICIENT_SCOPE',
    message: string
  ) {
    super(message)
    this.name = 'OrgTokenError'
  }
}

function extractOrganizationId(aud: string | string[] | undefined): string | null {
  const list = Array.isArray(aud) ? aud : aud ? [aud] : []
  for (const a of list) {
    if (a.startsWith(ORG_AUD_PREFIX)) return a.slice(ORG_AUD_PREFIX.length)
  }
  return null
}

/**
 * 校验组织 token 并映射成 OrgSession。任一环节失败抛 OrgTokenError。
 */
export async function verifyOrganizationToken(
  token: string,
  getKey: JWTVerifyGetKey | KeyLike | Uint8Array,
  options: VerifyOrgTokenOptions
): Promise<OrgSession> {
  let payload
  try {
    // jose 的 jwtVerify 同时接受 KeyLike 与 JWTVerifyGetKey
    const result = await jwtVerify(token, getKey as JWTVerifyGetKey, {
      issuer: options.issuer
    })
    payload = result.payload
  } catch (err) {
    throw new OrgTokenError('INVALID_TOKEN', `JWT verification failed: ${(err as Error).message}`)
  }

  const organizationId = extractOrganizationId(payload.aud)
  if (!organizationId) {
    throw new OrgTokenError('NO_ORG_AUDIENCE', 'Token has no organization audience')
  }

  if (options.expectedOrganizationId && organizationId !== options.expectedOrganizationId) {
    throw new OrgTokenError('ORG_MISMATCH', `Token org ${organizationId} != expected ${options.expectedOrganizationId}`)
  }

  const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ').filter(Boolean) : []

  if (options.requiredScopes?.length) {
    const tokenScopes = new Set(scopes)
    const missing = options.requiredScopes.filter(s => !tokenScopes.has(s))
    if (missing.length) {
      throw new OrgTokenError('INSUFFICIENT_SCOPE', `Missing scopes: ${missing.join(', ')}`)
    }
  }

  const rolesClaim = (payload as Record<string, unknown>).roles
  const roles = Array.isArray(rolesClaim) ? rolesClaim.map(String) : []

  return {
    userId: String(payload.sub ?? ''),
    organizationId,
    scopes,
    roles
  }
}
