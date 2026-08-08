import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { SubsystemMigrator } from './types'

const exec = promisify(execFile)

/**
 * 对租户业务库执行子系统 Prisma 迁移（生产实现）。
 * schemaPath 指向子系统的 schema.prisma；DATABASE_URL 注入目标库。
 */
export class PrismaSubsystemMigrator implements SubsystemMigrator {
  constructor(private readonly schemaPath: string) {}

  async migrate(databaseUrl: string): Promise<void> {
    try {
      await exec('pnpm', ['prisma', 'migrate', 'deploy', '--schema', this.schemaPath], {
        env: { ...process.env, DATABASE_URL: databaseUrl }
      })
    } catch (err) {
      throw new MigrationError(`prisma migrate deploy failed: ${(err as Error).message}`)
    }
  }
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationError'
  }
}
