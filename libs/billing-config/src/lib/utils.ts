import type {
  BillingConfig,
  BillingInterval,
  BillingOrderRecord,
  BillingPlanConfig,
  BillingSubscriptionRecord,
  BillingVariant
} from '@libs/billing-contract'

import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  BillingModel,
  BillingPlan,
  BillingSubscriptionStatus
} from '@libs/billing-contract'

import { billingConfig } from './catalog'

export { ACTIVE_SUBSCRIPTION_STATUSES }

export const getBillingPeriod = <
  T extends {
    status: BillingSubscriptionRecord['status']
    periodStartsAt: Date | string
    periodEndsAt: Date | string
    trialStartsAt?: Date | string | null
    trialEndsAt?: Date | string | null
  }
>(
  subscription: T
) => {
  const now = Date.now()
  const trialing = subscription.status === BillingSubscriptionStatus.TRIALING
  const startsAt = trialing ? (subscription.trialStartsAt ?? subscription.periodStartsAt) : subscription.periodStartsAt
  const endsAt = trialing ? (subscription.trialEndsAt ?? subscription.periodEndsAt) : subscription.periodEndsAt

  const startMs = new Date(startsAt).getTime()
  const endMs = new Date(endsAt).getTime()
  const total = Math.max(1, endMs - startMs)
  const elapsed = now - startMs
  const progress = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)))
  const daysRemaining = Math.max(0, Math.ceil((endMs - now) / (1000 * 60 * 60 * 24)))

  return {
    startsAt,
    endsAt,
    progress,
    daysRemaining,
    trial: trialing
  }
}

export function getBillingPlans(includeHidden = false, config: BillingConfig = billingConfig): BillingPlanConfig[] {
  if (includeHidden) {
    return [...config.plans]
  }

  return config.plans.map(plan => ({
    ...plan,
    variants: plan.variants.filter(variant => !variant.hidden)
  }))
}

export function findBillingPlan(
  planId: BillingPlan,
  config: BillingConfig = billingConfig
): BillingPlanConfig | undefined {
  return config.plans.find(plan => plan.id === planId)
}

export const findPlanById = findBillingPlan

export const findPlanByVariantId = (variantId: string, config: BillingConfig = billingConfig) => {
  const plan = config.plans.find(candidate => candidate.variants.some(variant => variant.id === variantId))
  const variant = plan?.variants.find(candidate => candidate.id === variantId)
  return { plan, variant }
}

export const findPlanIndexById = (id: string, config: BillingConfig = billingConfig) =>
  config.plans.findIndex(plan => plan.id === id)

export const getPlanFeatures = (id: string, config: BillingConfig = billingConfig): string[] => {
  const index = findPlanIndexById(id, config)
  if (index === -1) return []
  return Array.from(new Set(config.plans.slice(0, index + 1).flatMap(plan => plan.features ?? [])))
}

export function findBillingVariant(
  variantId: string,
  config: BillingConfig = billingConfig
): (BillingVariant & { planId: BillingPlan }) | undefined {
  for (const plan of config.plans) {
    const variant = plan.variants.find(candidate => candidate.id === variantId)

    if (variant) {
      return {
        ...variant,
        planId: plan.id
      }
    }
  }

  return undefined
}

export function findBillingVariantByStripePriceId(
  stripePriceId: string,
  config: BillingConfig = billingConfig
): (BillingVariant & { planId: BillingPlan }) | undefined {
  for (const plan of config.plans) {
    const variant = plan.variants.find(candidate => candidate.stripePriceId === stripePriceId)

    if (variant) {
      return {
        ...variant,
        planId: plan.id
      }
    }
  }

  return undefined
}

export function formatBillingPrice(cost: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(cost / 100)
}

export function formatBillingInterval(interval?: BillingInterval): string {
  return interval ?? ''
}

export function hasActiveSubscription(subscriptions: BillingSubscriptionRecord[]): boolean {
  return subscriptions.some(subscription => ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status))
}

export function getLatestSuccessfulOrder(orders: BillingOrderRecord[]): BillingOrderRecord | null {
  const order = [...orders]
    .filter(item => item.status === 'succeeded')
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0]

  return order ?? null
}

export function isRecurringVariant(variant: BillingVariant): boolean {
  return variant.model === BillingModel.RECURRING
}

export function getActivePlan<
  Entitlement extends { id: string; active: boolean; variantId?: string },
  Subscription extends { status: BillingSubscriptionRecord['status']; variantId: string },
  Order extends { status: string; variantId: string; updatedAt?: string | Date },
  Summary extends {
    entitlements?: Entitlement[]
    subscriptions?: Subscription[]
    orders?: Order[]
  }
>(summary?: Summary | Summary[], config: BillingConfig = billingConfig): BillingPlan {
  if (!summary) {
    return BillingPlan.FREE
  }

  const data = Array.isArray(summary) ? summary : [summary]
  const activeEntitlements = data
    .flatMap(customer => customer.entitlements ?? [])
    .filter(entitlement => entitlement.active)
  const activeSubscriptions = data
    .flatMap(customer => customer.subscriptions ?? [])
    .filter(subscription => ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status))
    .map(subscription => subscription.variantId)
    .filter(Boolean)
  const successfulOrders = data
    .flatMap(customer => customer.orders ?? [])
    .filter(order => order.status === 'succeeded')
    .map(order => order.variantId)
    .filter(Boolean)

  const availablePlans = [
    ...activeEntitlements.map(entitlement =>
      entitlement.variantId
        ? findPlanByVariantId(entitlement.variantId, config).plan
        : entitlement.id
          ? findPlanById(entitlement.id as BillingPlan, config)
          : null
    ),
    ...activeSubscriptions.map(id => findPlanByVariantId(id, config).plan),
    ...successfulOrders.map(id => findPlanByVariantId(id, config).plan)
  ].filter(Boolean) as { id: BillingPlan }[]

  if (!availablePlans.length) return BillingPlan.FREE

  const sorted = availablePlans.sort(
    (left, right) => findPlanIndexById(left.id, config) - findPlanIndexById(right.id, config)
  )
  return sorted[sorted.length - 1]?.id ?? BillingPlan.FREE
}
