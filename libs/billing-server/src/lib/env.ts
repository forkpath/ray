import type { Preset } from 'envin/types'

import { defineEnv } from 'envin'
import * as z from 'zod'

function getServerEnvVar(key: string): string | undefined {
  return process.env[key]
}

const booleanFlag = z.preprocess(value => {
  if (typeof value === 'string') {
    if (['1', 'true'].includes(value.toLowerCase())) return true
    if (['0', 'false'].includes(value.toLowerCase())) return false
  }

  return value ?? false
}, z.boolean())

export const serverPreset = {
  id: 'billing-server',
  server: {
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    REVENUECAT_API_KEY: z.string().optional(),
    REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
    BILLING_OWNER_V2_DUAL_WRITE: booleanFlag,
    BILLING_OWNER_V2_SHADOW_READ: booleanFlag,
    BILLING_OWNER_V2_READ: booleanFlag,
    ORGANIZATION_BILLING_ENABLED: booleanFlag,
    VITE_BILLING_STRIPE_PRICE_PREMIUM_LIFETIME: z.string().optional(),
    VITE_BILLING_STRIPE_PRICE_PREMIUM_MONTHLY: z.string().optional(),
    VITE_BILLING_STRIPE_PRICE_PREMIUM_YEARLY: z.string().optional()
  }
} as const satisfies Preset

export const serverEnv = defineEnv({
  ...serverPreset,
  env: {
    STRIPE_SECRET_KEY: getServerEnvVar('STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: getServerEnvVar('STRIPE_WEBHOOK_SECRET'),
    REVENUECAT_API_KEY: getServerEnvVar('REVENUECAT_API_KEY'),
    REVENUECAT_WEBHOOK_SECRET: getServerEnvVar('REVENUECAT_WEBHOOK_SECRET'),
    BILLING_OWNER_V2_DUAL_WRITE: getServerEnvVar('BILLING_OWNER_V2_DUAL_WRITE'),
    BILLING_OWNER_V2_SHADOW_READ: getServerEnvVar('BILLING_OWNER_V2_SHADOW_READ'),
    BILLING_OWNER_V2_READ: getServerEnvVar('BILLING_OWNER_V2_READ'),
    ORGANIZATION_BILLING_ENABLED: getServerEnvVar('ORGANIZATION_BILLING_ENABLED'),
    VITE_BILLING_STRIPE_PRICE_PREMIUM_LIFETIME: getServerEnvVar('VITE_BILLING_STRIPE_PRICE_PREMIUM_LIFETIME'),
    VITE_BILLING_STRIPE_PRICE_PREMIUM_MONTHLY: getServerEnvVar('VITE_BILLING_STRIPE_PRICE_PREMIUM_MONTHLY'),
    VITE_BILLING_STRIPE_PRICE_PREMIUM_YEARLY: getServerEnvVar('VITE_BILLING_STRIPE_PRICE_PREMIUM_YEARLY')
  }
})
