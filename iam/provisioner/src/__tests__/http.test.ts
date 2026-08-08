import type { ProvisionDeps } from '../provision-tenant'

import { describe, expect, it, vi } from 'vitest'

import { createApp } from '../http'
import { InMemoryTenantRegistry } from '../tenant-registry'

function makeDeps(): ProvisionDeps {
  return {
    org: {
      createOrganization: vi.fn(async () => ({ id: 'org_acme' })),
      addUser: vi.fn().mockResolvedValue(undefined),
      assignRole: vi.fn().mockResolvedValue(undefined),
      deleteOrganization: vi.fn().mockResolvedValue(undefined)
    },
    db: {
      provisionDatabase: vi.fn(async () => ({ dbName: 'tenant_org_acme', databaseUrl: 'postgres://x/y' })),
      deprovisionDatabase: vi.fn().mockResolvedValue(undefined)
    },
    migrator: { migrate: vi.fn().mockResolvedValue(undefined) },
    router: {
      createTenantRoute: vi.fn(async () => ({ serviceId: 'svc-1', routeId: 'rt-1' })),
      deleteTenantRoute: vi.fn().mockResolvedValue(undefined)
    },
    deployer: {
      deploy: vi.fn().mockResolvedValue(undefined),
      teardown: vi.fn().mockResolvedValue(undefined)
    },
    registry: new InMemoryTenantRegistry(),
    domainSuffix: 'example.com'
  }
}

describe('provisioner http', () => {
  it('POST /tenants returns 201 with provisioning result', async () => {
    const app = createApp(makeDeps())
    const res = await app.request('/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme', orgIdSeed: 'acme', ownerUserId: 'u1', tier: 'shared' })
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ orgId: 'org_acme', domain: 'acme.example.com' })
  })

  it('POST /tenants returns 400 on missing fields', async () => {
    const app = createApp(makeDeps())
    const res = await app.request('/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme' })
    })
    expect(res.status).toBe(400)
  })

  it('DELETE /tenants/:orgId triggers deprovision', async () => {
    const deps = makeDeps()
    const app = createApp(deps)
    await app.request('/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme', orgIdSeed: 'acme', ownerUserId: 'u1', tier: 'shared' })
    })
    const res = await app.request('/tenants/org_acme', { method: 'DELETE' })
    expect(res.status).toBe(200)
    expect(deps.org.deleteOrganization).toHaveBeenCalledWith('org_acme')
  })
})
