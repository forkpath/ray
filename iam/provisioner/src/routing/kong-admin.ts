import type { RouterProvisioner } from '../types'

import { assertSafeOrgId } from '../../../shared/src/identifier'

/**
 * Kong Admin API 客户端（方案 B：DB 模式，动态增删路由）。
 *
 * 静态基础设施配置由 deck 用 tag=base 管理；本客户端只操作打了
 * tag=tenant / org:<id> 的动态租户路由，确保 deck sync 不误删。
 * fetch 注入以便单测。Admin API 必须仅内网可达（ADR-0007）。
 */
const TENANT_TAGS = (orgId: string) => ['tenant', `org:${orgId}`]

export class KongAdminClient implements RouterProvisioner {
  constructor(
    private readonly adminUrl: string,
    private readonly fetchFn: typeof fetch = fetch
  ) {}

  async createTenantRoute(input: {
    orgId: string
    domain: string
    upstreamUrl: string
  }): Promise<{ serviceId: string; routeId: string }> {
    assertSafeOrgId(input.orgId)
    const tags = TENANT_TAGS(input.orgId)

    const svcRes = await this.fetchFn(`${this.adminUrl}/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `tenant-${input.orgId}`, url: input.upstreamUrl, tags })
    })
    if (!svcRes.ok) throw new Error(`createService failed: ${svcRes.status}`)
    const service = (await svcRes.json()) as { id: string }

    const rtRes = await this.fetchFn(`${this.adminUrl}/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: { id: service.id }, hosts: [input.domain], tags })
    })
    if (!rtRes.ok) throw new Error(`createRoute failed: ${rtRes.status}`)
    const route = (await rtRes.json()) as { id: string }

    return { serviceId: service.id, routeId: route.id }
  }

  async attachPlugin(routeId: string, name: string, config: Record<string, unknown>): Promise<void> {
    const res = await this.fetchFn(`${this.adminUrl}/routes/${routeId}/plugins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, config })
    })
    if (!res.ok) throw new Error(`attachPlugin failed: ${res.status}`)
  }

  async deleteTenantRoute(ids: { serviceId: string; routeId: string }): Promise<void> {
    // 先删 route 再删 service（route 依赖 service）；404 幂等
    const rtRes = await this.fetchFn(`${this.adminUrl}/routes/${ids.routeId}`, { method: 'DELETE' })
    if (!rtRes.ok && rtRes.status !== 404) throw new Error(`deleteRoute failed: ${rtRes.status}`)

    const svcRes = await this.fetchFn(`${this.adminUrl}/services/${ids.serviceId}`, { method: 'DELETE' })
    if (!svcRes.ok && svcRes.status !== 404) throw new Error(`deleteService failed: ${svcRes.status}`)
  }
}
