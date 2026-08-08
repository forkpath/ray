import type { TenantRecord, TenantRegistry, TenantStatus } from './types'

import pg from 'pg'

/**
 * Postgres 版租户注册表（生产实现）。表自迁移（IF NOT EXISTS）。
 */
export class PgTenantRegistry implements TenantRegistry {
  private readonly pool: pg.Pool

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString })
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS iam_tenants (
        org_id          text PRIMARY KEY,
        name            text NOT NULL,
        db_name         text,
        domain          text,
        tier            text NOT NULL DEFAULT 'shared',
        status          text NOT NULL DEFAULT 'pending',
        kong_service_id text,
        kong_route_id   text,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now()
      )
    `)
  }

  async upsert(r: TenantRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO iam_tenants (org_id, name, db_name, domain, tier, status, kong_service_id, kong_route_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (org_id) DO UPDATE SET
         name=$2, db_name=$3, domain=$4, tier=$5, status=$6,
         kong_service_id=$7, kong_route_id=$8, updated_at=now()`,
      [r.orgId, r.name, r.dbName, r.domain, r.tier, r.status, r.kongServiceId, r.kongRouteId]
    )
  }

  async get(orgId: string): Promise<TenantRecord | null> {
    const res = await this.pool.query('SELECT * FROM iam_tenants WHERE org_id = $1', [orgId])
    const row = res.rows[0]
    return row ? this.toRecord(row) : null
  }

  async list(): Promise<TenantRecord[]> {
    const res = await this.pool.query('SELECT * FROM iam_tenants ORDER BY created_at')
    return res.rows.map(r => this.toRecord(r))
  }

  async setStatus(orgId: string, status: TenantStatus): Promise<void> {
    const res = await this.pool.query('UPDATE iam_tenants SET status=$2, updated_at=now() WHERE org_id=$1', [
      orgId,
      status
    ])
    if (res.rowCount === 0) throw new Error(`Tenant not found: ${orgId}`)
  }

  async close(): Promise<void> {
    await this.pool.end()
  }

  private toRecord(row: Record<string, unknown>): TenantRecord {
    return {
      orgId: row.org_id as string,
      name: row.name as string,
      dbName: (row.db_name as string) ?? null,
      domain: (row.domain as string) ?? null,
      tier: row.tier as TenantRecord['tier'],
      status: row.status as TenantStatus,
      kongServiceId: (row.kong_service_id as string) ?? null,
      kongRouteId: (row.kong_route_id as string) ?? null
    }
  }
}
