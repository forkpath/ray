import type { BillingConfig } from '@libs/billing-contract'

import { BillingInterval, BillingModel, BillingPlan } from '@libs/billing-contract'

import { mobileEnv, webEnv } from '../env'

const PREMIUM_LIFETIME_VARIANT_ID = 'premium-lifetime'
const PREMIUM_MONTHLY_VARIANT_ID = 'premium-monthly'
const PREMIUM_YEARLY_VARIANT_ID = 'premium-yearly'

export const billingConfig: BillingConfig = {
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
          id: PREMIUM_LIFETIME_VARIANT_ID,
          cost: 19900,
          model: BillingModel.ONE_TIME,
          stripePriceId: webEnv.VITE_BILLING_STRIPE_PRICE_PREMIUM_LIFETIME,
          revenueCatProductIds: {
            ios: mobileEnv.EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_LIFETIME
          }
        },
        {
          id: PREMIUM_MONTHLY_VARIANT_ID,
          cost: 1900,
          interval: BillingInterval.MONTH,
          trialDays: 7,
          model: BillingModel.RECURRING,
          stripePriceId: webEnv.VITE_BILLING_STRIPE_PRICE_PREMIUM_MONTHLY,
          revenueCatProductIds: {
            ios: mobileEnv.EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_MONTHLY,
            android: mobileEnv.EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_MONTHLY
          }
        },
        {
          id: PREMIUM_YEARLY_VARIANT_ID,
          cost: 8900,
          interval: BillingInterval.YEAR,
          trialDays: 7,
          model: BillingModel.RECURRING,
          stripePriceId: webEnv.VITE_BILLING_STRIPE_PRICE_PREMIUM_YEARLY,
          revenueCatProductIds: {
            ios: mobileEnv.EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_YEARLY,
            android: mobileEnv.EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_YEARLY
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
