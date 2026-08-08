import type { ProvisionDeps } from '../provision-tenant'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { deprovisionTenant, ProvisionError, provisionTenant } from '../provision-tenant'
import { InMemoryTenantRegistry } from '../tenant-registry'

function makeDeps() {
  const org = {
    createOrganization: vi.fn(async () => ({ id: 'org_acme' })),
    addUser: vi.fn().mockResolvedValue(undefined),
    assignRole: vi.fn().mockResolvedValue(undefined),
    deleteOrganization: vi.fn().mockResolvedValue(undefined)
  }
  const db = {
    provisionDatabase: vi.fn(async () => ({
      dbName: 'tenant_org_acme',
      databaseUrl: 'postgres://x/tenant_org_acme'
    })),
    deprovisionDatabase: vi.fn().mockResolvedValue(undefined)
  }
  const migrator = { migrate: vi.fn().mockResolvedValue(undefined) }
  const router = {
    createTenantRoute: vi.fn(async () => ({ serviceId: 'svc-1', routeId: 'rt-1' })),
    deleteTenantRoute: vi.fn().mockResolvedValue(undefined)
  }
  const deployer = {
    deploy: vi.fn().mockResolvedValue(undefined),
    teardown: vi.fn().mockResolvedValue(undefined)
  }
  const registry = new InMemoryTenantRegistry()
  const deps: ProvisionDeps = {
    org,
    db,
    migrator,
    router,
    deployer,
    registry,
    domainSuffix: 'example.com'
  }
  return { deps, org, db, migrator, router, deployer, registry }
}

const input = {
  name: 'Acme',
  orgIdSeed: 'acme',
  ownerUserId: 'user_1',
  tier: 'dedicated' as const,
  manifestPath: '/runtime/tenants/acme/compose.yml'
}

describe('provisionTenant — happy path', () => {
  it('runs all stages in order and records active tenant', async () => {
    const { deps, org, db, migrator, router, deployer, registry } = makeDeps()
    const result = await provisionTenant(input, deps)

    expect(result).toEqual({
      orgId: 'org_acme',
      dbName: 'tenant_org_acme',
      domain: 'acme.example.com',
      kongServiceId: 'svc-1',
      kongRouteId: 'rt-1'
    })
    expect(org.createOrganization).toHaveBeenCalledWith({ name: 'Acme' })
    expect(org.addUser).toHaveBeenCalledWith('org_acme', 'user_1')
    expect(org.assignRole).toHaveBeenCalledWith('org_acme', 'user_1', 'org-admin')
    expect(db.provisionDatabase).toHaveBeenCalledWith('org_acme')
    expect(migrator.migrate).toHaveBeenCalledWith('postgres://x/tenant_org_acme')
    expect(router.createTenantRoute).toHaveBeenCalledWith({
      orgId: 'org_acme',
      domain: 'acme.example.com',
      upstreamUrl: 'http://sub-org_acme:3000'
    })
    expect(deployer.deploy).toHaveBeenCalledWith('org_acme', input.manifestPath)

    const stored = await registry.get('org_acme')
    expect(stored?.status).toBe('active')
    expect(stored?.kongRouteId).toBe('rt-1')
  })

  it('shared tier skips dedicated deploy and routes to shared upstream', async () => {
    const { deps, deployer, router } = makeDeps()
    await provisionTenant({ ...input, tier: 'shared', manifestPath: undefined }, deps)
    expect(deployer.deploy).not.toHaveBeenCalled()
    expect(router.createTenantRoute).toHaveBeenCalledWith(
      expect.objectContaining({ upstreamUrl: 'http://subsystem-shared:3000' })
    )
  })
})

describe('provisionTenant — rollback matrix', () => {
  let ctx: ReturnType<typeof makeDeps>
  beforeEach(() => {
    ctx = makeDeps()
  })

  it('rolls back organization when database provisioning fails', async () => {
    ctx.db.provisionDatabase.mockRejectedValueOnce(new Error('disk full'))
    await expect(provisionTenant(input, ctx.deps)).rejects.toBeInstanceOf(ProvisionError)
    expect(ctx.org.deleteOrganization).toHaveBeenCalledWith('org_acme')
    expect(ctx.router.deleteTenantRoute).not.toHaveBeenCalled()
    expect((await ctx.registry.get('org_acme'))?.status).toBe('failed')
  })

  it('rolls back org + database when migration fails', async () => {
    ctx.migrator.migrate.mockRejectedValueOnce(new Error('bad migration'))
    await expect(provisionTenant(input, ctx.deps)).rejects.toBeInstanceOf(ProvisionError)
    expect(ctx.db.deprovisionDatabase).toHaveBeenCalledWith('org_acme')
    expect(ctx.org.deleteOrganization).toHaveBeenCalledWith('org_acme')
  })

  it('tears down route + database + org when deploy fails', async () => {
    ctx.deployer.deploy.mockRejectedValueOnce(new Error('compose failed'))
    await expect(provisionTenant(input, ctx.deps)).rejects.toBeInstanceOf(ProvisionError)
    expect(ctx.router.deleteTenantRoute).toHaveBeenCalledWith({ serviceId: 'svc-1', routeId: 'rt-1' })
    expect(ctx.db.deprovisionDatabase).toHaveBeenCalledWith('org_acme')
    expect(ctx.org.deleteOrganization).toHaveBeenCalledWith('org_acme')
    expect((await ctx.registry.get('org_acme'))?.status).toBe('failed')
  })

  it('deletes the org even when its id fails safety validation (no orphan)', async () => {
    ctx.org.createOrganization.mockResolvedValueOnce({ id: 'BAD;DROP' })
    await expect(provisionTenant(input, ctx.deps)).rejects.toBeInstanceOf(ProvisionError)
    // 校验抛错后仍用原始 id 回收，避免 Logto 侧孤儿组织
    expect(ctx.org.deleteOrganization).toHaveBeenCalledWith('BAD;DROP')
  })

  it('compensation runs in reverse order', async () => {
    const order: string[] = []
    ctx.org.deleteOrganization.mockImplementation(async () => void order.push('org'))
    ctx.db.deprovisionDatabase.mockImplementation(async () => void order.push('db'))
    ctx.router.deleteTenantRoute.mockImplementation(async () => void order.push('route'))
    ctx.deployer.deploy.mockRejectedValueOnce(new Error('boom'))

    await expect(provisionTenant(input, ctx.deps)).rejects.toBeInstanceOf(ProvisionError)
    expect(order).toEqual(['route', 'db', 'org'])
  })
})

describe('deprovisionTenant', () => {
  it('reverse-recovers an active tenant and is idempotent', async () => {
    const { deps, registry, deployer, router, db, org } = makeDeps()
    await provisionTenant(input, deps)

    await deprovisionTenant('org_acme', deps)
    expect(deployer.teardown).toHaveBeenCalledWith('org_acme')
    expect(router.deleteTenantRoute).toHaveBeenCalledWith({ serviceId: 'svc-1', routeId: 'rt-1' })
    expect(db.deprovisionDatabase).toHaveBeenCalledWith('org_acme')
    expect(org.deleteOrganization).toHaveBeenCalledWith('org_acme')
    expect((await registry.get('org_acme'))?.status).toBe('deprovisioned')

    // 二次调用幂等：不再触发回收
    deployer.teardown.mockClear()
    await deprovisionTenant('org_acme', deps)
    expect(deployer.teardown).not.toHaveBeenCalled()
  })

  it('is a no-op for unknown tenant', async () => {
    const { deps, org } = makeDeps()
    await deprovisionTenant('org_unknown', deps)
    expect(org.deleteOrganization).not.toHaveBeenCalled()
  })
})
