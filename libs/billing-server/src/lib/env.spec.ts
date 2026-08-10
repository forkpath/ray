import { describe, expect, it } from 'vitest'

import { serverPreset } from './env'

describe('Billing server environment contract', () => {
  it('contains only Node provider and server catalog variables', () => {
    expect(Object.keys(serverPreset.server).sort()).toEqual([
      'REVENUECAT_API_KEY',
      'REVENUECAT_WEBHOOK_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'VITE_BILLING_STRIPE_PRICE_PREMIUM_LIFETIME',
      'VITE_BILLING_STRIPE_PRICE_PREMIUM_MONTHLY',
      'VITE_BILLING_STRIPE_PRICE_PREMIUM_YEARLY'
    ])
  })
})
