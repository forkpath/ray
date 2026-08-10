import { PrismaPg } from '@prisma/adapter-pg'

import { NodeEnv } from '@libs/common'

import { resolvePostgresDatabaseUrl } from './database-url'
import { env } from './env'
import { Prisma, PrismaClient } from './generated/prisma/client'

export { Prisma }

const databaseUrl = resolvePostgresDatabaseUrl(env)
const adapter = new PrismaPg({ connectionString: databaseUrl })

const globalForPrisma = global as unknown as {
  prisma?: PrismaClient
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

/* 因为在开发环境（尤其是热更新/热重载）里，模块会被反复加载。
 * 如果每次都 new PrismaClient，会创建多个连接实例并触发 Prisma 的 “Too many clients” 警告。
 */
if (env.NODE_ENV !== NodeEnv.PRODUCTION) {
  globalForPrisma.prisma = prisma
}
