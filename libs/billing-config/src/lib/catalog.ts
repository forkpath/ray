import type { BillingConfig } from '@libs/billing-contract'

import { BillingInterval, BillingModel, BillingPlan } from '@libs/billing-contract'

export interface BillingConfigInput {
  stripe?: {
    premiumLifetimePriceId?: string
    premiumMonthlyPriceId?: string
    premiumYearlyPriceId?: string
  }
  revenueCat?: {
    premiumLifetimeProductId?: string
    premiumMonthlyProductId?: string
    premiumYearlyProductId?: string
  }
}

export function createBillingConfig(input: BillingConfigInput = {}): BillingConfig {
  return {
    plans: [
      {
        id: BillingPlan.FREE,
        name: 'billing:plan.free.name',
        description: 'billing:plan.free.description',
        badge: null,
        features: ['billing:feature.free.workspace', 'billing:feature.free.email'],
        variants: [
          {
            id: 'free-lifetime',
            cost: 0,
            model: BillingModel.ONE_TIME
          }
        ]
      },
      {
        id: BillingPlan.PREMIUM,
        name: 'billing:plan.premium.name',
        description: 'billing:plan.premium.description',
        badge: 'billing:plan.premium.badge',
        features: [
          'billing:feature.premium.workspace',
          'billing:feature.premium.analytics',
          'billing:feature.premium.monitoring'
        ],
        variants: [
          {
            id: 'premium-lifetime',
            cost: 19900,
            model: BillingModel.ONE_TIME,
            stripePriceId: input.stripe?.premiumLifetimePriceId,
            revenueCatProductIds: {
              ios: input.revenueCat?.premiumLifetimeProductId
            }
          },
          {
            id: 'premium-monthly',
            cost: 1900,
            interval: BillingInterval.MONTH,
            trialDays: 7,
            model: BillingModel.RECURRING,
            stripePriceId: input.stripe?.premiumMonthlyPriceId,
            revenueCatProductIds: {
              ios: input.revenueCat?.premiumMonthlyProductId,
              android: input.revenueCat?.premiumMonthlyProductId
            }
          },
          {
            id: 'premium-yearly',
            cost: 8900,
            interval: BillingInterval.YEAR,
            trialDays: 7,
            model: BillingModel.RECURRING,
            stripePriceId: input.stripe?.premiumYearlyPriceId,
            revenueCatProductIds: {
              ios: input.revenueCat?.premiumYearlyProductId,
              android: input.revenueCat?.premiumYearlyProductId
            }
          }
        ]
      },
      {
        id: BillingPlan.ENTERPRISE,
        name: 'billing:plan.enterprise.name',
        description: 'billing:plan.enterprise.description',
        badge: null,
        features: [
          'billing:feature.enterprise.sso',
          'billing:feature.enterprise.audit',
          'billing:feature.enterprise.support'
        ],
        variants: [
          {
            id: 'enterprise-contact',
            label: 'common:contactUs',
            href: '/contact',
            cost: 0,
            model: BillingModel.RECURRING,
            custom: true
          }
        ]
      }
    ],
    discounts: []
  }
}

export const billingConfig = createBillingConfig()
