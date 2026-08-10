import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getBillingCustomersByOwner, upsertBillingCustomer } from './persistence'

const { findMany, findUnique, upsert } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn()
}))

vi.mock('@libs/pg-dao', () => ({
  prisma: {
    customer: {
      findMany,
      findUnique,
      upsert
    }
  }
}))

const legacyFlags = {
  dualWrite: false,
  shadowRead: false,
  v2Read: false,
  organizationBilling: false
}

const customer = (input: { id: string; userId?: string | null; organizationId?: string | null }) => ({
  id: input.id,
  referenceId: 'user-1',
  userId: input.userId ?? null,
  organizationId: input.organizationId ?? null,
  provider: 'stripe',
  externalId: `cus-${input.id}`,
  createdAt: new Date('2026-08-11T00:00:00.000Z'),
  updatedAt: new Date('2026-08-11T00:00:00.000Z')
})

describe('billing owner persistence compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the legacy reference query while V2 reads are disabled', async () => {
    findMany.mockResolvedValue([customer({ id: 'legacy' })])

    await expect(
      getBillingCustomersByOwner({ kind: 'user', userId: 'user-1' }, 'stripe', { flags: legacyFlags })
    ).resolves.toMatchObject([{ id: 'legacy', owner: { kind: 'user', userId: 'user-1' }, referenceId: 'user-1' }])
    expect(findMany).toHaveBeenCalledWith({
      where: { referenceId: 'user-1', provider: 'stripe' },
      orderBy: { createdAt: 'desc' }
    })
  })

  it('reports a shadow mismatch but continues returning legacy results', async () => {
    findMany
      .mockResolvedValueOnce([customer({ id: 'legacy' })])
      .mockResolvedValueOnce([customer({ id: 'v2', userId: 'user-1' })])
    const reportShadowMismatch = vi.fn()

    const result = await getBillingCustomersByOwner({ kind: 'user', userId: 'user-1' }, undefined, {
      flags: { ...legacyFlags, shadowRead: true },
      reportShadowMismatch
    })

    expect(result.map(item => item.id)).toEqual(['legacy'])
    expect(reportShadowMismatch).toHaveBeenCalledWith({
      owner: { kind: 'user', userId: 'user-1' },
      provider: undefined,
      legacyCustomerIds: ['legacy'],
      v2CustomerIds: ['v2']
    })
    expect(findMany).toHaveBeenNthCalledWith(2, {
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' }
    })
  })

  it('switches to the explicit owner query only when V2 read is enabled', async () => {
    findMany.mockResolvedValue([customer({ id: 'v2', organizationId: 'org-1' })])

    const result = await getBillingCustomersByOwner({ kind: 'organization', organizationId: 'org-1' }, 'stripe', {
      flags: { ...legacyFlags, v2Read: true }
    })

    expect(result[0]?.owner).toEqual({ kind: 'organization', organizationId: 'org-1' })
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', provider: 'stripe' },
      orderBy: { createdAt: 'desc' }
    })
  })

  it('rejects a stored owner that conflicts with the requested owner', async () => {
    findMany.mockResolvedValue([customer({ id: 'wrong-owner', userId: 'user-2' })])

    await expect(
      getBillingCustomersByOwner({ kind: 'user', userId: 'user-1' }, 'stripe', {
        flags: { ...legacyFlags, v2Read: true }
      })
    ).rejects.toThrow('does not match the requested owner')
  })

  it('always preserves referenceId and only writes owner columns behind dual-write', async () => {
    upsert.mockResolvedValue(customer({ id: 'created', userId: 'user-1' }))

    await upsertBillingCustomer(
      { owner: { kind: 'user', userId: 'user-1' }, provider: 'stripe', externalId: 'cus-created' },
      { flags: { ...legacyFlags, dualWrite: true } }
    )

    expect(upsert).toHaveBeenCalledWith({
      where: { referenceId_provider: { referenceId: 'user-1', provider: 'stripe' } },
      create: {
        referenceId: 'user-1',
        userId: 'user-1',
        organizationId: null,
        provider: 'stripe',
        externalId: 'cus-created'
      },
      update: {
        referenceId: 'user-1',
        externalId: 'cus-created',
        userId: 'user-1',
        organizationId: null
      }
    })
  })
})
