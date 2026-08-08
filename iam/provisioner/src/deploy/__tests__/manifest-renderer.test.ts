import { describe, expect, it } from 'vitest'

import { renderManifest } from '../manifest-renderer'

const base = {
  orgId: 'acme',
  databaseUrlEnvKey: 'TENANT_acme_DATABASE_URL',
  logto: { endpoint: 'https://auth.example.com', appId: 'app-1' },
  image: 'ray/subsystem:latest'
}

describe('renderManifest', () => {
  it('renders a dedicated service injecting org/db/logto, secrets as env placeholders', () => {
    const r = renderManifest({ ...base, tier: 'dedicated' })
    expect(r.shared).toBe(false)
    if (r.shared) return
    expect(r.serviceName).toBe('sub-acme')
    expect(r.content).toContain('ORG_ID: acme')
    expect(r.content).toContain('DATABASE_URL: ${TENANT_acme_DATABASE_URL}')
    expect(r.content).toContain('LOGTO_ENDPOINT: https://auth.example.com')
    // 不得明文写入真实连接串
    expect(r.content).not.toContain('postgres://')
  })

  it('returns a shared marker without rendering a dedicated service', () => {
    const r = renderManifest({ ...base, tier: 'shared' })
    expect(r).toEqual({ shared: true })
  })

  it('rejects unsafe orgId', () => {
    expect(() => renderManifest({ ...base, orgId: '../evil', tier: 'dedicated' })).toThrow(/Unsafe/)
  })
})
