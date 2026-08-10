import { describe, expect, it, vi } from 'vitest'

import { BetterAuthPulseSessionVerifier } from './pulse-session.verifier'

describe('BetterAuthPulseSessionVerifier', () => {
  it('maps only governed session identity fields', async () => {
    const verifier = new BetterAuthPulseSessionVerifier({
      getSession: vi.fn().mockResolvedValue({
        session: {
          expiresAt: '2026-08-12T00:00:00.000Z',
          activeOrganizationId: 'org_01'
        },
        user: { id: 'user_01', email: 'private@example.com' }
      })
    })

    await expect(verifier.verify({ cookie: 'session=opaque' })).resolves.toEqual({
      activeOrganizationId: 'org_01',
      expiresAt: new Date('2026-08-12T00:00:00.000Z'),
      userId: 'user_01'
    })
  })

  it('rejects missing and malformed sessions', async () => {
    const missing = new BetterAuthPulseSessionVerifier({ getSession: vi.fn().mockResolvedValue(null) })
    const malformed = new BetterAuthPulseSessionVerifier({
      getSession: vi.fn().mockResolvedValue({ session: { expiresAt: 'never' }, user: { id: 'user_01' } })
    })

    await expect(missing.verify({})).resolves.toBeNull()
    await expect(malformed.verify({})).resolves.toBeNull()
  })
})
