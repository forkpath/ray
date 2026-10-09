import type { CanActivate, ContextType, ExecutionContext } from '@nestjs/common'
import type { WsException as WsExceptionClass } from '@nestjs/websockets'
import type { AuthModuleOptions } from './auth-module-definition'
import type { getSession } from 'better-auth/api'

import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { fromNodeHeaders } from 'better-auth/node'

import { MODULE_OPTIONS_TOKEN } from './auth-module-definition'
import { getRequestFromContext } from './utils'

/**
 * 认证后有效的 Session 类型（排除 null/undefined）。
 */
export type BaseUserSession = NonNullable<Awaited<ReturnType<ReturnType<typeof getSession>>>>

export type UserSession = BaseUserSession & {
  user: BaseUserSession['user'] & {
    role?: string | string[]
  }
}

/**
 * 懒加载 WsException，避免强制依赖 @nestjs/websockets。
 */
let WsException: typeof WsExceptionClass | undefined
function getWsException(): typeof WsExceptionClass {
  if (WsException) return WsException
  try {
    const loaded: typeof WsExceptionClass = require('@nestjs/websockets').WsException
    WsException = loaded
    return loaded
  } catch (error) {
    throw new Error(
      '@nestjs/websockets is required for WebSocket support. Please install it: npm install @nestjs/websockets @nestjs/platform-ws, error: ' +
        error
    )
  }
}

const AuthContextErrorMap: Record<ContextType, Record<'UNAUTHORIZED' | 'FORBIDDEN', (args?: unknown) => Error>> = {
  http: {
    UNAUTHORIZED: args =>
      new UnauthorizedException(
        args ?? {
          code: 'UNAUTHORIZED',
          message: 'Unauthorized'
        }
      ),
    FORBIDDEN: args =>
      new ForbiddenException(
        args ?? {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      )
  },
  ws: {
    UNAUTHORIZED: args => {
      const WsExceptionClass = getWsException()
      return new WsExceptionClass(args ?? 'UNAUTHORIZED')
    },
    FORBIDDEN: args => {
      const WsExceptionClass = getWsException()
      return new WsExceptionClass(args ?? 'FORBIDDEN')
    }
  },
  rpc: {
    UNAUTHORIZED: () => new Error('UNAUTHORIZED'),
    FORBIDDEN: () => new Error('FORBIDDEN')
  }
}

/**
 * 负责鉴权的 Guard。
 * 可通过 @AllowAnonymous() / @OptionalAuth() 调整鉴权行为。
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(MODULE_OPTIONS_TOKEN)
    private readonly options: AuthModuleOptions
  ) {}

  /**
   * 验证当前请求是否有权限访问。
   * 会把 session 与 user 挂到 request 上，方便后续使用。
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequestFromContext(context)
    const session: UserSession | null = await this.options.auth.api.getSession({
      headers: fromNodeHeaders(request.headers || request?.handshake?.headers || [])
    })

    request.session = session
    // 便于观测工具（如 Sentry）读取用户信息
    request.user = session?.user ?? null

    const isPublic = this.reflector.getAllAndOverride<boolean>('PUBLIC', [context.getHandler(), context.getClass()])

    if (isPublic) return true

    const isOptional = this.reflector.getAllAndOverride<boolean>('OPTIONAL', [context.getHandler(), context.getClass()])

    // 可选鉴权且无 session 时直接放行
    if (!session && isOptional) return true

    const ctxType = context.getType()
    if (!session) throw AuthContextErrorMap[ctxType].UNAUTHORIZED()

    const requiredRoles = this.reflector.getAllAndOverride<string[]>('ROLES', [
      context.getHandler(),
      context.getClass()
    ])

    // 需要角色校验时，判断是否匹配任意角色
    if (requiredRoles && requiredRoles.length > 0) {
      const userRole = session.user.role
      let hasRole = false
      if (Array.isArray(userRole)) {
        hasRole = userRole.some(role => requiredRoles.includes(role))
      } else if (typeof userRole === 'string') {
        hasRole = userRole.split(',').some(role => requiredRoles.includes(role))
      }

      if (!hasRole) throw AuthContextErrorMap[ctxType].FORBIDDEN()
    }

    return true
  }
}
