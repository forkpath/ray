import { describe, expect, it } from 'vitest'

import {
  billingOwnerFeatureFlags,
  findBillingOwnerShadowMismatch,
  getBillingOwnerId,
  getBillingOwnerWhere,
  getBillingOwnerWriteData,
  getStoredBillingOwner,
  validateBillingOwnerFeatureFlags
} from './owner-routing'

const flags = {
  dualWrite: false,
  shadowRead: false,
  v2Read: false,
  organizationBilling: false
}

describe('billing owner routing', () => {
  it('keeps the validated startup flag snapshot immutable', () => {
    expect(billingOwnerFeatureFlags).toEqual(flags)
    expect(Object.isFrozen(billingOwnerFeatureFlags)).toBe(true)
  })

  it('maps user and organization owners without inventing a shared id field', () => {
    expect(getBillingOwnerId({ kind: 'user', userId: 'user-1' })).toBe('user-1')
    expect(getBillingOwnerWhere({ kind: 'user', userId: 'user-1' })).toEqual({ userId: 'user-1' })
    expect(getBillingOwnerId({ kind: 'organization', organizationId: 'org-1' })).toBe('org-1')
    expect(getBillingOwnerWhere({ kind: 'organization', organizationId: 'org-1' })).toEqual({
      organizationId: 'org-1'
    })
  })

  it('keeps V2 columns untouched until dual-write is enabled', () => {
    expect(getBillingOwnerWriteData({ kind: 'user', userId: 'user-1' }, flags)).toEqual({})
  })

  it('dual-writes exactly one owner and clears the opposite column', () => {
    const dualWriteFlags = { ...flags, dualWrite: true }

    expect(getBillingOwnerWriteData({ kind: 'user', userId: 'user-1' }, dualWriteFlags)).toEqual({
      userId: 'user-1',
      organizationId: null
    })
    expect(getBillingOwnerWriteData({ kind: 'organization', organizationId: 'org-1' }, dualWriteFlags)).toEqual({
      userId: null,
      organizationId: 'org-1'
    })
  })

  it('rejects ambiguous stored ownership instead of guessing', () => {
    expect(getStoredBillingOwner({ userId: null, organizationId: null })).toBeNull()
    expect(getStoredBillingOwner({ userId: 'user-1', organizationId: null })).toEqual({
      kind: 'user',
      userId: 'user-1'
    })
    expect(() => getStoredBillingOwner({ userId: 'user-1', organizationId: 'org-1' })).toThrow('ambiguous ownership')
  })

  it('compares shadow reads as stable customer-id sets', () => {
    const owner = { kind: 'user', userId: 'user-1' } as const

    expect(
      findBillingOwnerShadowMismatch({ owner, legacyCustomerIds: ['b', 'a'], v2CustomerIds: ['a', 'b'] })
    ).toBeNull()
    expect(findBillingOwnerShadowMismatch({ owner, legacyCustomerIds: ['legacy'], v2CustomerIds: ['v2'] })).toEqual({
      owner,
      legacyCustomerIds: ['legacy'],
      v2CustomerIds: ['v2']
    })
  })

  it('rejects unsafe flag activation and rollback order', () => {
    expect(() => validateBillingOwnerFeatureFlags({ ...flags, shadowRead: true })).toThrow(
      'SHADOW_READ requires BILLING_OWNER_V2_DUAL_WRITE'
    )
    expect(() => validateBillingOwnerFeatureFlags({ ...flags, dualWrite: true, v2Read: true })).toThrow(
      'V2_READ requires dual-write and shadow-read'
    )
    expect(() => validateBillingOwnerFeatureFlags({ ...flags, organizationBilling: true })).toThrow(
      'ORGANIZATION_BILLING_ENABLED requires BILLING_OWNER_V2_READ'
    )
    expect(
      validateBillingOwnerFeatureFlags({
        dualWrite: true,
        shadowRead: true,
        v2Read: true,
        organizationBilling: true
      })
    ).toEqual({ dualWrite: true, shadowRead: true, v2Read: true, organizationBilling: true })
  })
})
