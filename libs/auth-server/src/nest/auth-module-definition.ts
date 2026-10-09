import type { Auth, BetterAuthOptions } from 'better-auth'
import type { NextFunction, Request, Response } from 'express'

import { ConfigurableModuleBuilder } from '@nestjs/common'

// Nest 适配器实际使用的 auth 能力。betterAuth(...) 的返回值按配置推导出具体类型，
// 与默认的 Auth<BetterAuthOptions> 不兼容，因此这里只约束结构，任何实例都可直接传入。
export interface AuthType {
  handler: Auth['handler']
  api: Pick<Auth['api'], 'getSession'>
  options: Pick<BetterAuthOptions, 'basePath' | 'trustedOrigins' | 'hooks'>
}

// 模块配置项：auth 实例 + 行为开关
export type AuthModuleOptions<A = AuthType> = {
  auth: A
  disableTrustedOriginsCors?: boolean
  disableBodyParser?: boolean
  middleware?: (req: Request, res: Response, next: NextFunction) => void
}

// Nest 注入 token
export const MODULE_OPTIONS_TOKEN = Symbol('AUTH_MODULE_OPTIONS') as symbol

// Hook 相关元数据 key
export const BEFORE_HOOK_KEY = Symbol('BEFORE_HOOK') as symbol
export const AFTER_HOOK_KEY = Symbol('AFTER_HOOK') as symbol
export const HOOK_KEY = Symbol('HOOK') as symbol

export const { ConfigurableModuleClass, OPTIONS_TYPE, ASYNC_OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<AuthModuleOptions>({
    optionsInjectionToken: MODULE_OPTIONS_TOKEN
  })
    .setClassMethodName('forRoot')
    .setExtras(
      {
        isGlobal: true,
        disableGlobalAuthGuard: false,
        disableControllers: false
      },
      (def, extras) => {
        return {
          ...def,
          exports: [MODULE_OPTIONS_TOKEN],
          global: extras.isGlobal
        }
      }
    )
    .build()
