import type { TenantRecord, TenantRegistry, TenantStatus } from './types'

/**
 * 内存版租户注册表：用于编排层单测与本地试跑。
 * 生产用 PgTenantRegistry（见 pg-tenant-registry.ts，集成测试覆盖）。
 */
export class InMemoryTenantRegistry implements TenantRegistry {
  private readonly store = new Map<string, TenantRecord>()

  async upsert(record: TenantRecord): Promise<void> {
    this.store.set(record.orgId, { ...record })
  }

  async get(orgId: string): Promise<TenantRecord | null> {
    const r = this.store.get(orgId)
    return r ? { ...r } : null
  }

  async list(): Promise<TenantRecord[]> {
    return [...this.store.values()].map(r => ({ ...r }))
  }

  async setStatus(orgId: string, status: TenantStatus): Promise<void> {
    const r = this.store.get(orgId)
    if (!r) throw new Error(`Tenant not found: ${orgId}`)
    r.status = status
  }
}
