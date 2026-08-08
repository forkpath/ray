import type { TenantRecord } from '../types'

import { describe, expect, it } from 'vitest'

import { InMemoryTenantRegistry } from '../tenant-registry'

const rec: TenantRecord = {
  orgId: 'org_acme',
  name: 'Acme',
  dbName: 'tenant_org_acme',
  domain: 'acme.example.com',
  tier: 'dedicated',
  status: 'pending',
  kongServiceId: null,
  kongRouteId: null
}

describe('InMemoryTenantRegistry', () => {
  it('upserts and reads back a copy (no shared mutation)', async () => {
    const r = new InMemoryTenantRegistry()
    await r.upsert(rec)
    const got = await r.get('org_acme')
    expect(got).toEqual(rec)
    if (!got) throw new Error('expected tenant record')
    got.status = 'active'
    expect((await r.get('org_acme'))?.status).toBe('pending')
  })

  it('transitions status', async () => {
    const r = new InMemoryTenantRegistry()
    await r.upsert(rec)
    await r.setStatus('org_acme', 'active')
    expect((await r.get('org_acme'))?.status).toBe('active')
  })

  it('throws when setting status on unknown tenant', async () => {
    const r = new InMemoryTenantRegistry()
    await expect(r.setStatus('nope', 'active')).rejects.toThrow(/not found/)
  })

  it('lists all tenants', async () => {
    const r = new InMemoryTenantRegistry()
    await r.upsert(rec)
    await r.upsert({ ...rec, orgId: 'org_beta' })
    expect((await r.list()).map(t => t.orgId).sort()).toEqual(['org_acme', 'org_beta'])
  })
})
