import type { DatabaseProvisioner } from './types'

import pg from 'pg'

import { tenantDbName } from '../../shared/src/identifier'

/**
 * Postgres 业务库编排（生产实现）。
 *
 * 安全要害：DDL 不能参数化，库名必须先经 tenantDbName 白名单派生才能拼接，
 * 否则存在 SQL 注入。CREATE/DROP 通过预查 pg_database 实现幂等。
 */
export interface PgDatabaseProvisionerConfig {
  /** 管理连接（有建库权限），如 postgres://postgres:pw@host:5432/postgres */
  adminUrl: string
  /** 拼接租户库连接串的模板，{db} 占位 */
  tenantUrlTemplate: string // 例如 postgres://postgres:pw@host:5432/{db}
}

export class PgDatabaseProvisioner implements DatabaseProvisioner {
  constructor(private readonly config: PgDatabaseProvisionerConfig) {}

  private tenantUrl(dbName: string): string {
    return this.config.tenantUrlTemplate.replace('{db}', dbName)
  }

  async provisionDatabase(orgId: string): Promise<{ dbName: string; databaseUrl: string }> {
    const dbName = tenantDbName(orgId) // 已做白名单校验
    const client = new pg.Client({ connectionString: this.config.adminUrl })
    await client.connect()
    try {
      const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])
      if (exists.rowCount === 0) {
        // dbName 已白名单校验，可安全拼接（DDL 不支持参数化）
        await client.query(`CREATE DATABASE "${dbName}"`)
      }
    } finally {
      await client.end()
    }
    return { dbName, databaseUrl: this.tenantUrl(dbName) }
  }

  async deprovisionDatabase(orgId: string): Promise<void> {
    const dbName = tenantDbName(orgId)
    const client = new pg.Client({ connectionString: this.config.adminUrl })
    await client.connect()
    try {
      // 先断开残留连接再删库
      await client.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [dbName]
      )
      await client.query(`DROP DATABASE IF EXISTS "${dbName}"`)
    } finally {
      await client.end()
    }
  }
}
