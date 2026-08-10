import { describe, expect, it } from 'vitest'

import { serverPreset } from './env'

describe('Billing server environment contract', () => {
  it('contains only Node provider and server catalog variables', () => {
    expect(Object.keys(serverPreset.server).sort()).toEqual([
      'BILLING_OWNER_V2_DUAL_WRITE',
      'BILLING_OWNER_V2_READ',
      'BILLING_OWNER_V2_SHADOW_READ',
      'ORGANIZATION_BILLING_ENABLED',
      'REVENUECAT_API_KEY',
      'REVENUECAT_WEBHOOK_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'VITE_BILLING_STRIPE_PRICE_PREMIUM_LIFETIME',
      'VITE_BILLING_STRIPE_PRICE_PREMIUM_MONTHLY',
      'VITE_BILLING_STRIPE_PRICE_PREMIUM_YEARLY'
    ])
  })

  it('parses migration switches as strict booleans that default to false', () => {
    const flag = serverPreset.server.BILLING_OWNER_V2_DUAL_WRITE

    expect(flag.parse(undefined)).toBe(false)
    expect(flag.parse('false')).toBe(false)
    expect(flag.parse('1')).toBe(true)
    expect(() => flag.parse('yes')).toThrow()
  })
})
