import { describe, expect, it } from 'vitest'

import { BillingPlan, BillingSubscriptionStatus } from '@libs/billing-contract'

import { billingConfig, createBillingConfig } from './catalog'
import { findBillingVariantByStripePriceId, findPlanByVariantId, getActivePlan } from './utils'

describe('billing catalog', () => {
  it('keeps the universal catalog free of runtime environment values', () => {
    const premium = billingConfig.plans.find(plan => plan.id === BillingPlan.PREMIUM)

    expect(premium?.variants).toHaveLength(3)
    expect(premium?.variants.every(variant => variant.stripePriceId === undefined)).toBe(true)
  })

  it('injects provider identifiers without changing stable variant ids', () => {
    const configured = createBillingConfig({
      stripe: { premiumMonthlyPriceId: 'price_monthly' },
      revenueCat: { premiumMonthlyProductId: 'rc_monthly' }
    })
    const monthly = findPlanByVariantId('premium-monthly', configured).variant

    expect(monthly?.stripePriceId).toBe('price_monthly')
    expect(monthly?.revenueCatProductIds).toEqual({ ios: 'rc_monthly', android: 'rc_monthly' })
    expect(findBillingVariantByStripePriceId('price_monthly', configured)?.id).toBe('premium-monthly')
  })

  it('derives the highest active plan from transport-neutral summaries', () => {
    expect(
      getActivePlan({
        subscriptions: [{ status: BillingSubscriptionStatus.ACTIVE, variantId: 'premium-yearly' }]
      })
    ).toBe(BillingPlan.PREMIUM)
  })
})
