/**
 * Provisioner HTTP 薄壳（Hono）。仅做入参校验 + 调编排，零业务逻辑。
 *
 * POST   /tenants        开通租户
 * DELETE /tenants/:orgId  解除开通
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ProvisionDeps } from './provision-tenant'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import { ManagementClient } from '../../bootstrap/src/management-client'
import { PgDatabaseProvisioner } from './database-provisioner'
import { ComposeDeployer } from './deploy/deployer'
import { LogtoOrganizationProvisioner } from './organization-provisioner'
import { PgTenantRegistry } from './pg-tenant-registry'
import { deprovisionTenant, provisionTenant } from './provision-tenant'
import { KongAdminClient } from './routing/kong-admin'
import { PrismaSubsystemMigrator } from './subsystem-migrator'

const exec = promisify(execFile)

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

export function buildDeps(): ProvisionDeps & { registry: PgTenantRegistry } {
  const logtoEndpoint = requireEnv('LOGTO_ENDPOINT')
  const pgAdminUrl = requireEnv('PG_ADMIN_URL')
  const management = new ManagementClient({
    endpoint: logtoEndpoint,
    m2mId: requireEnv('LOGTO_M2M_APP_ID'),
    m2mSecret: requireEnv('LOGTO_M2M_APP_SECRET')
  })
  const registry = new PgTenantRegistry(pgAdminUrl)
  return {
    org: new LogtoOrganizationProvisioner({
      endpoint: logtoEndpoint,
      getToken: () => management.getToken()
    }),
    db: new PgDatabaseProvisioner({
      adminUrl: pgAdminUrl,
      tenantUrlTemplate: `postgres://${requireEnv('TENANT_DB_USER')}:${requireEnv('TENANT_DB_PASSWORD')}@${requireEnv('TENANT_DB_HOST')}:${requireEnv('TENANT_DB_PORT')}/{db}`
    }),
    migrator: new PrismaSubsystemMigrator(process.env.SUBSYSTEM_SCHEMA_PATH ?? './prisma/schema.prisma'),
    router: new KongAdminClient(requireEnv('KONG_ADMIN_URL')),
    deployer: new ComposeDeployer((cmd, args) => exec(cmd, args).then(() => undefined)),
    registry,
    domainSuffix: process.env.TENANT_DOMAIN_SUFFIX ?? 'example.com'
  }
}

export function createApp(deps: ProvisionDeps) {
  const app = new Hono()

  app.post('/tenants', async c => {
    const body = await c.req.json().catch(() => null)
    if (!body?.name || !body?.orgIdSeed || !body?.ownerUserId || !body?.tier) {
      return c.json({ error: 'name, orgIdSeed, ownerUserId, tier required' }, 400)
    }
    try {
      const result = await provisionTenant(body, deps)
      return c.json(result, 201)
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500)
    }
  })

  app.delete('/tenants/:orgId', async c => {
    await deprovisionTenant(c.req.param('orgId'), deps)
    return c.json({ ok: true })
  })

  return app
}

// 直接运行时启动服务
if (import.meta.url === `file://${process.argv[1]}`) {
  const deps = buildDeps()
  await deps.registry.init()
  const app = createApp(deps)
  const port = Number(process.env.PORT ?? 4000)
  serve({ fetch: app.fetch, port })
  console.log(`Provisioner listening on :${port}`)
}
