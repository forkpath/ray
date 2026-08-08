import type {
  DatabaseProvisioner,
  Deployer,
  OrganizationProvisioner,
  RouterProvisioner,
  SubsystemMigrator,
  TenantRegistry,
  TenantTier
} from './types'

import { assertSafeDomainLabel, assertSafeOrgId } from '../../shared/src/identifier'

export interface ProvisionDeps {
  org: OrganizationProvisioner
  db: DatabaseProvisioner
  migrator: SubsystemMigrator
  router: RouterProvisioner
  deployer: Deployer
  registry: TenantRegistry
  domainSuffix: string // 例如 example.com → acme.example.com
}

export interface ProvisionInput {
  name: string
  orgIdSeed: string // 用于派生安全的 orgId / 子域（如组织 slug）
  ownerUserId: string
  tier: TenantTier
  role?: string // 默认 org-admin
  manifestPath?: string // dedicated tier 的部署清单路径
}

export interface ProvisionResult {
  orgId: string
  dbName: string
  domain: string
  kongServiceId: string
  kongRouteId: string
}

export class ProvisionError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown
  ) {
    super(message)
    this.name = 'ProvisionError'
  }
}

/**
 * 端到端开通编排，含逐阶段逆向补偿。
 *
 * 顺序：createOrganization → addUser → assignRole → provisionDatabase →
 *       migrate → createTenantRoute → deploy → registry(active)
 * 任一阶段失败：逆序执行已登记的补偿动作，注册表标记 failed，抛 ProvisionError。
 */
export async function provisionTenant(input: ProvisionInput, deps: ProvisionDeps): Promise<ProvisionResult> {
  const slug = assertSafeDomainLabel(input.orgIdSeed)
  const domain = `${slug}.${deps.domainSuffix}`
  const role = input.role ?? 'org-admin'

  // 补偿栈：每完成一个有副作用的步骤，push 一个 undo
  const undo: Array<() => Promise<void>> = []
  const rollback = async () => {
    for (const fn of undo.reverse()) {
      try {
        await fn()
      } catch {
        // 补偿尽力而为，单个失败不阻断其余回滚
      }
    }
  }

  let orgId = ''
  try {
    // 1. 建组织。先用原始 id 登记补偿，再做安全校验——否则校验抛错时
    //    已创建的组织会成为孤儿（补偿栈尚未登记）。
    const org = await deps.org.createOrganization({ name: input.name })
    undo.push(() => deps.org.deleteOrganization(org.id))
    // Logto 返回的 org id 会用于 DDL/Kong/URL，必须过安全校验。
    orgId = assertSafeOrgId(org.id)

    // 注册表先登记 pending（便于观测与幂等）
    await deps.registry.upsert({
      orgId,
      name: input.name,
      dbName: null,
      domain,
      tier: input.tier,
      status: 'pending',
      kongServiceId: null,
      kongRouteId: null
    })

    // 2. 加成员 + 授角色
    await deps.org.addUser(orgId, input.ownerUserId)
    await deps.org.assignRole(orgId, input.ownerUserId, role)

    // 3. 业务库
    const { dbName, databaseUrl } = await deps.db.provisionDatabase(orgId)
    undo.push(() => deps.db.deprovisionDatabase(orgId))

    // 4. 库迁移
    await deps.migrator.migrate(databaseUrl)

    // 5. Kong 动态路由
    const upstreamUrl = input.tier === 'dedicated' ? `http://sub-${orgId}:3000` : 'http://subsystem-shared:3000'
    const route = await deps.router.createTenantRoute({ orgId, domain, upstreamUrl })
    undo.push(() => deps.router.deleteTenantRoute(route))

    // 6. 部署（shared tier 走共享实例，deploy 为 noop）
    if (input.tier === 'dedicated' && input.manifestPath) {
      await deps.deployer.deploy(orgId, input.manifestPath)
      undo.push(() => deps.deployer.teardown(orgId))
    }

    // 7. 落库 active
    await deps.registry.upsert({
      orgId,
      name: input.name,
      dbName,
      domain,
      tier: input.tier,
      status: 'active',
      kongServiceId: route.serviceId,
      kongRouteId: route.routeId
    })

    return {
      orgId,
      dbName,
      domain,
      kongServiceId: route.serviceId,
      kongRouteId: route.routeId
    }
  } catch (err) {
    await rollback()
    if (orgId) {
      try {
        await deps.registry.setStatus(orgId, 'failed')
      } catch {
        // 注册表本身失败不掩盖原始错误
      }
    }
    throw new ProvisionError(`Provisioning failed for "${input.name}": ${(err as Error).message}`, err)
  }
}

/**
 * 解除开通：依注册表记录逆序回收，幂等。
 */
export async function deprovisionTenant(orgId: string, deps: ProvisionDeps): Promise<void> {
  const record = await deps.registry.get(orgId)
  if (!record || record.status === 'deprovisioned') return

  if (record.tier === 'dedicated') await deps.deployer.teardown(orgId)
  if (record.kongServiceId && record.kongRouteId) {
    await deps.router.deleteTenantRoute({
      serviceId: record.kongServiceId,
      routeId: record.kongRouteId
    })
  }
  await deps.db.deprovisionDatabase(orgId)
  await deps.org.deleteOrganization(orgId)
  await deps.registry.setStatus(orgId, 'deprovisioned')
}
