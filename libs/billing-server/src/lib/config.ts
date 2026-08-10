import { createBillingConfig } from '@libs/billing-config'

import { serverEnv } from './env'

export const billingConfig = createBillingConfig({
  stripe: {
    premiumLifetimePriceId: serverEnv.VITE_BILLING_STRIPE_PRICE_PREMIUM_LIFETIME,
    premiumMonthlyPriceId: serverEnv.VITE_BILLING_STRIPE_PRICE_PREMIUM_MONTHLY,
    premiumYearlyPriceId: serverEnv.VITE_BILLING_STRIPE_PRICE_PREMIUM_YEARLY
  }
})
