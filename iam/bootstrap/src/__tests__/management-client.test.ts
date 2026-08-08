import { describe, expect, it, vi } from 'vitest'

import { buildTokenRequest, ManagementClient } from '../management-client'

const cfg = { endpoint: 'http://logto:3001', m2mId: 'id', m2mSecret: 'secret' }

describe('buildTokenRequest', () => {
  it('builds a client_credentials request with basic auth and api resource', () => {
    const { url, init } = buildTokenRequest(cfg)
    expect(url).toBe('http://logto:3001/oidc/token')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Basic ' + Buffer.from('id:secret').toString('base64')
    )
    expect(init.body).toContain('grant_type=client_credentials')
    expect(init.body).toContain('resource=http%3A%2F%2Flogto%3A3001%2Fapi')
    expect(init.body).toContain('scope=all')
  })

  it('throws when credentials missing', () => {
    expect(() => buildTokenRequest({ endpoint: 'x', m2mId: '', m2mSecret: '' })).toThrow(/M2M/)
    expect(() => buildTokenRequest({ endpoint: '', m2mId: 'a', m2mSecret: 'b' })).toThrow(/endpoint/)
  })
})

describe('ManagementClient', () => {
  it('caches token until near expiry', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tok', expires_in: 3600 })
    } as Response)
    const client = new ManagementClient({ ...cfg, fetchFn: fetchMock as unknown as typeof fetch })
    expect(await client.getToken()).toBe('tok')
    expect(await client.getToken()).toBe('tok')
    expect(fetchMock).toHaveBeenCalledTimes(1) // 第二次命中缓存
  })
})
