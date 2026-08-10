import { BillingOrderStatus, BillingProvider, BillingSubscriptionStatus } from '@libs/common'

export { BillingOrderStatus, BillingProvider, BillingSubscriptionStatus }

export const SubscriptionStatus = BillingSubscriptionStatus
export type SubscriptionStatus = BillingSubscriptionStatus
export const PaymentStatus = BillingOrderStatus
export type PaymentStatus = BillingOrderStatus

export const ACTIVE_SUBSCRIPTION_STATUSES: BillingSubscriptionStatus[] = [
  BillingSubscriptionStatus.ACTIVE,
  BillingSubscriptionStatus.TRIALING
]

export const BillingPlan = {
  FREE: 'free',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise'
} as const

export type BillingPlan = (typeof BillingPlan)[keyof typeof BillingPlan]

export const BillingModel = {
  ONE_TIME: 'one-time',
  RECURRING: 'recurring'
} as const

export type BillingModel = (typeof BillingModel)[keyof typeof BillingModel]

export const BillingInterval = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  YEAR: 'year'
} as const

export type BillingInterval = (typeof BillingInterval)[keyof typeof BillingInterval]

export interface BillingVariant {
  id: string
  label?: string
  href?: string
  cost: number
  model: BillingModel
  interval?: BillingInterval
  trialDays?: number
  hidden?: boolean
  custom?: boolean
  stripePriceId?: string
  revenueCatProductIds?: {
    ios?: string
    android?: string
  }
}

export interface BillingPlanConfig {
  id: BillingPlan
  name: string
  description: string
  badge: string | null
  features: string[]
  variants: BillingVariant[]
}

export interface BillingDiscount {
  code: string
  value: number
  type: 'percent' | 'amount'
  appliesTo: string[]
}

export interface BillingConfig {
  plans: BillingPlanConfig[]
  discounts: BillingDiscount[]
}

export interface BillingCustomerRecord {
  id: string
  referenceId: string
  externalId: string
  provider: string
  createdAt: Date
  updatedAt: Date
}

export interface BillingSubscriptionRecord {
  id: string
  customerId: string
  externalId: string
  variantId: string
  status: BillingSubscriptionStatus
  store: string
  periodStartsAt: Date
  periodEndsAt: Date
  trialStartsAt: Date | null
  trialEndsAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface BillingOrderRecord {
  id: string
  customerId: string
  externalId: string
  variantId: string
  status: BillingOrderStatus
  store: string
  createdAt: Date
  updatedAt: Date
}

export interface BillingSummaryCustomer extends BillingCustomerRecord {
  subscriptions: BillingSubscriptionRecord[]
  orders: BillingOrderRecord[]
  entitlements?: BillingMobileEntitlement[]
}

export type BillingSummary = BillingSummaryCustomer[]

export type Subscription = BillingSubscriptionRecord
export type Order = BillingOrderRecord

export interface BillingCheckoutInput {
  referenceId: string
  email: string
  variantId: string
  successUrl: string
  cancelUrl: string
}

export interface BillingPortalInput {
  referenceId: string
  email: string
  returnUrl: string
}

export interface BillingMobileEntitlement {
  id: string
  active: boolean
  variantId?: string
}

export const MobileStore = {
  APP_STORE: 'app_store',
  PLAY_STORE: 'play_store'
} as const

export type MobileStore = (typeof MobileStore)[keyof typeof MobileStore]

export const MOBILE_STORE_LINKS = {
  [MobileStore.APP_STORE]: 'https://apps.apple.com/account/subscriptions',
  [MobileStore.PLAY_STORE]: 'https://play.google.com/store/account/subscriptions'
} as const satisfies Record<MobileStore, string>

export const PaywallResult = {
  IDLE: 'idle',
  PURCHASED: 'purchased',
  RESTORED: 'restored',
  DISMISSED: 'dismissed',
  SKIPPED: 'skipped',
  ERROR: 'error'
} as const

export type PaywallResult = (typeof PaywallResult)[keyof typeof PaywallResult]

export interface PaywallCallbacks {
  onPresent?: () => void
  onDismiss?: () => void
  onPurchase?: () => void
  onRestore?: () => void
  onSkip?: () => void
  onError?: (error: unknown) => void
}
