import type { OrgSession } from './jwt'
import type { JWTVerifyGetKey, KeyLike } from 'jose'

import { OrgTokenError, verifyOrganizationToken } from './jwt'

/**
 * 框架无关的请求授权核心（Plan 3 的认证内核）。
 *
 * NestJS LogtoAuthGuard、引擎、子系统都把它当作唯一鉴权判定点：
 * 复用 verifyOrganizationToken（已验证），按路由元数据决定放行/拒绝，
 * 产出与旧 better-auth UserSession 形状兼容的 session（ADR-0004）。
 *
 * 不依赖 NestJS/Express，因此可在 iam 工作区完整单测。
 */

/** 与旧 better-auth UserSession 形状兼容，便于控制器零改动迁移。 */
export interface CompatSession {
  user: { id: string; roles: string[] }
  organizationId: string
  scopes: string[]
}

export interface RouteAuthMeta {
  /** @AllowAnonymous：完全放行 */
  public?: boolean
  /** @OptionalAuth：无 token 放行，session 为 null */
  optional?: boolean
  /** 访问所需粗粒度 scope（子系统访问白名单） */
  requiredScopes?: string[]
  /** 访问所需组织角色（任一匹配即可） */
  requiredRoles?: string[]
}

export interface AuthorizeConfig {
  issuer: string
  getKey: JWTVerifyGetKey | KeyLike | Uint8Array
}

export class AuthzError extends Error {
  constructor(
    public readonly status: 401 | 403,
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'AuthzError'
  }
}

export function extractBearer(authorization: string | undefined | null): string | null {
  if (!authorization) return null
  const m = /^Bearer (.+)$/.exec(authorization)
  return m?.[1] ?? null
}

function toCompat(session: OrgSession): CompatSession {
  return {
    user: { id: session.userId, roles: session.roles },
    organizationId: session.organizationId,
    scopes: session.scopes
  }
}

/**
 * 核心：根据 Authorization 头与路由元数据判定。
 * - public：始终放行，session=null
 * - 无 token：optional 放行(null)，否则 401
 * - token 无效/scope 不足：抛 verify 内的错误 → 映射 401/403
 * - requiredRoles 不满足：403
 */
export async function authorizeRequest(
  authorization: string | undefined | null,
  meta: RouteAuthMeta,
  config: AuthorizeConfig
): Promise<CompatSession | null> {
  if (meta.public) {
    const tokenMaybe = extractBearer(authorization)
    if (!tokenMaybe) return null
    // public 路由也尽量解析 session（供观测），失败则忽略
    try {
      return toCompat(await verifyOrganizationToken(tokenMaybe, config.getKey, { issuer: config.issuer }))
    } catch {
      return null
    }
  }

  const token = extractBearer(authorization)
  if (!token) {
    if (meta.optional) return null
    throw new AuthzError(401, 'UNAUTHORIZED', 'Missing bearer token')
  }

  let session: OrgSession
  try {
    session = await verifyOrganizationToken(token, config.getKey, {
      issuer: config.issuer,
      requiredScopes: meta.requiredScopes
    })
  } catch (err) {
    if (err instanceof OrgTokenError && err.code === 'INSUFFICIENT_SCOPE') {
      throw new AuthzError(403, 'FORBIDDEN', err.message)
    }
    throw new AuthzError(401, 'UNAUTHORIZED', (err as Error).message)
  }

  const requiredRoles = meta.requiredRoles
  if (requiredRoles?.length) {
    const has = session.roles.some(r => requiredRoles.includes(r))
    if (!has) {
      throw new AuthzError(403, 'FORBIDDEN', `Requires one of roles: ${requiredRoles.join(', ')}`)
    }
  }

  return toCompat(session)
}
