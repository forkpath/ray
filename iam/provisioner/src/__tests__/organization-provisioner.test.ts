import { describe, expect, it, vi } from 'vitest'

import { LogtoOrganizationProvisioner } from '../organization-provisioner'

function ok(body: unknown = {}) {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}

function make(fetchMock: ReturnType<typeof vi.fn>) {
  return new LogtoOrganizationProvisioner({
    endpoint: 'http://logto:3001',
    getToken: async () => 'm2m-token',
    fetchFn: fetchMock as unknown as typeof fetch
  })
}

describe('LogtoOrganizationProvisioner', () => {
  it('creates an organization with bearer auth', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok({ id: 'org_x' }))
    const res = await make(fetchMock).createOrganization({ name: 'Acme' })
    expect(res).toEqual({ id: 'org_x' })
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const [url, init] = call ?? []
    expect(url).toBe('http://logto:3001/api/organizations')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer m2m-token'
    })
  })

  it('assigns an organization role via the roles endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(ok())
    await make(fetchMock).assignRole('org_x', 'user_1', 'developer')
    const call = fetchMock.mock.calls[0]
    expect(call).toBeDefined()
    const [url, init] = call ?? []
    expect(url).toBe('http://logto:3001/api/organizations/org_x/users/user_1/roles')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      organizationRoleNames: ['developer']
    })
  })

  it('treats 404 on delete as idempotent success', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    await expect(make(fetchMock).deleteOrganization('org_gone')).resolves.toBeUndefined()
  })

  it('throws on non-ok create', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 } as Response)
    await expect(make(fetchMock).createOrganization({ name: 'x' })).rejects.toThrow(/500/)
  })
})
