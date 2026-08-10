import { describe, expect, it } from 'vitest'

import { PaywallResult } from '@libs/billing-contract'

import { normalizePaywallResult } from './paywall-result'

describe('normalizePaywallResult', () => {
  it.each([
    ['PURCHASED', PaywallResult.PURCHASED],
    ['RESTORED', PaywallResult.RESTORED],
    ['CANCELLED', PaywallResult.DISMISSED],
    ['NOT_PRESENTED', PaywallResult.SKIPPED],
    ['ERROR', PaywallResult.ERROR],
    ['UNKNOWN', PaywallResult.ERROR]
  ])('normalizes %s fail-closed', (nativeResult, expected) => {
    expect(normalizePaywallResult(nativeResult)).toBe(expected)
  })
})
