import { describe, expect, it, vi } from 'vitest'

import { KongAdminClient } from '../kong-admin'

function okJson(body: unknown) {
  return { ok: true, status: 201, json: async () => body } as unknown as Response
}

describe('KongAdminClient', () => {
  it('creates a tenant service+route tagged by org', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okJson({ id: 'svc-1' }))
      .mockResolvedValueOnce(okJson({ id: 'rt-1' }))
    const kong = new KongAdminClient('http://kong:8001', fetchMock as unknown as typeof fetch)

    const res = await kong.createTenantRoute({
      orgId: 'acme',
      domain: 'acme.example.com',
      upstreamUrl: 'http://sub-acme:3000'
    })

    expect(res).toEqual({ serviceId: 'svc-1', routeId: 'rt-1' })
    const svcInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    const rtInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined
    expect(svcInit?.body).toBeDefined()
    expect(rtInit?.body).toBeDefined()
    const svcBody = JSON.parse(String(svcInit?.body))
    expect(svcBody).toMatchObject({
      url: 'http://sub-acme:3000',
      name: 'tenant-acme',
      tags: ['tenant', 'org:acme']
    })
    const rtBody = JSON.parse(String(rtInit?.body))
    expect(rtBody).toMatchObject({
      hosts: ['acme.example.com'],
      service: { id: 'svc-1' },
      tags: ['tenant', 'org:acme']
    })
  })

  it('rejects unsafe orgId before any network call', async () => {
    const fetchMock = vi.fn()
    const kong = new KongAdminClient('http://kong:8001', fetchMock as unknown as typeof fetch)
    await expect(kong.createTenantRoute({ orgId: 'acme; DROP', domain: 'x', upstreamUrl: 'y' })).rejects.toThrow(
      /Unsafe/
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('deletes route then service, idempotent on 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 204 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
    const kong = new KongAdminClient('http://kong:8001', fetchMock as unknown as typeof fetch)
    await expect(kong.deleteTenantRoute({ serviceId: 'svc-1', routeId: 'rt-1' })).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://kong:8001/routes/rt-1', { method: 'DELETE' })
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://kong:8001/services/svc-1', { method: 'DELETE' })
  })
})
