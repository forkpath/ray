import type { OrganizationProvisioner } from './types'

/**
 * 基于 Logto Management API 的组织编排（纯 REST）。
 *
 * token 通过注入的 getToken 提供（client_credentials，scope=all），
 * fetch 注入以便单测。生产由 Provisioner 缓存并刷新 M2M token。
 */
export interface LogtoOrgProvisionerDeps {
  endpoint: string
  getToken: () => Promise<string>
  fetchFn?: typeof fetch
}

export class LogtoOrganizationProvisioner implements OrganizationProvisioner {
  private readonly fetchFn: typeof fetch

  constructor(private readonly deps: LogtoOrgProvisionerDeps) {
    this.fetchFn = deps.fetchFn ?? fetch
  }

  private async call(path: string, method: string, body?: unknown): Promise<Response> {
    const token = await this.deps.getToken()
    const res = await this.fetchFn(`${this.deps.endpoint}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    return res
  }

  async createOrganization(input: { name: string }): Promise<{ id: string }> {
    const res = await this.call('/organizations', 'POST', { name: input.name })
    if (!res.ok) throw new Error(`createOrganization failed: ${res.status}`)
    const data = (await res.json()) as { id: string }
    return { id: data.id }
  }

  async addUser(orgId: string, userId: string): Promise<void> {
    const res = await this.call(`/organizations/${orgId}/users`, 'POST', { userIds: [userId] })
    if (!res.ok) throw new Error(`addUser failed: ${res.status}`)
  }

  async assignRole(orgId: string, userId: string, role: string): Promise<void> {
    const res = await this.call(`/organizations/${orgId}/users/${userId}/roles`, 'POST', {
      organizationRoleNames: [role]
    })
    if (!res.ok) throw new Error(`assignRole failed: ${res.status}`)
  }

  async deleteOrganization(orgId: string): Promise<void> {
    const res = await this.call(`/organizations/${orgId}`, 'DELETE')
    // 删除幂等：404 视为已删除
    if (!res.ok && res.status !== 404) throw new Error(`deleteOrganization failed: ${res.status}`)
  }
}
