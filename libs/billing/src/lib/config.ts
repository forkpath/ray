import { createBillingConfig } from '@libs/billing-config'

import { mobileEnv, webEnv } from '../env'

export const billingConfig = createBillingConfig({
  stripe: {
    premiumLifetimePriceId: webEnv.VITE_BILLING_STRIPE_PRICE_PREMIUM_LIFETIME,
    premiumMonthlyPriceId: webEnv.VITE_BILLING_STRIPE_PRICE_PREMIUM_MONTHLY,
    premiumYearlyPriceId: webEnv.VITE_BILLING_STRIPE_PRICE_PREMIUM_YEARLY
  },
  revenueCat: {
    premiumLifetimeProductId: mobileEnv.EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_LIFETIME,
    premiumMonthlyProductId: mobileEnv.EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_MONTHLY,
    premiumYearlyProductId: mobileEnv.EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_YEARLY
  }
})
