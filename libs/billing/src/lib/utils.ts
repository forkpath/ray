import type {
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

import { billingConfig } from './config'

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

  const startMs = new Date(startsAt as Date | string).getTime()
  const endMs = new Date(endsAt as Date | string).getTime()
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

export function getBillingPlans(includeHidden = false): BillingPlanConfig[] {
  if (includeHidden) {
    return [...billingConfig.plans]
  }

  return billingConfig.plans.map(plan => ({
    ...plan,
    variants: plan.variants.filter(variant => !variant.hidden)
  }))
}

export function findBillingPlan(planId: BillingPlan): BillingPlanConfig | undefined {
  return billingConfig.plans.find(plan => plan.id === planId)
}

export const findPlanById = findBillingPlan

export const findPlanByVariantId = (variantId: string) => {
  const plan = billingConfig.plans.find(p => p.variants.some(v => v.id === variantId))
  const variant = plan?.variants.find(v => v.id === variantId)
  return { plan, variant }
}

export const findPlanIndexById = (id: string) => billingConfig.plans.findIndex(p => p.id === id)

export const getPlanFeatures = (id: string): string[] => {
  const idx = findPlanIndexById(id)
  if (idx === -1) return []
  return Array.from(new Set(billingConfig.plans.slice(0, idx + 1).flatMap(p => p.features ?? [])))
}

export function findBillingVariant(variantId: string): (BillingVariant & { planId: BillingPlan }) | undefined {
  for (const plan of billingConfig.plans) {
    const variant = plan.variants.find(item => item.id === variantId)

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
  stripePriceId: string
): (BillingVariant & { planId: BillingPlan }) | undefined {
  for (const plan of billingConfig.plans) {
    const variant = plan.variants.find(item => item.stripePriceId === stripePriceId)

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
  if (!interval) {
    return ''
  }

  return interval
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
>(summary?: Summary | Summary[] | undefined): BillingPlan {
  if (!summary) {
    return BillingPlan.FREE
  }

  const data = Array.isArray(summary) ? summary : [summary]

  const activeEntitlements = data
    .flatMap(customer => customer?.entitlements ?? [])
    .filter(entitlement => entitlement?.active)

  const activeSubscriptions = data
    .flatMap(customer => customer?.subscriptions ?? [])
    .filter(s => s?.status && ACTIVE_SUBSCRIPTION_STATUSES.includes(s.status))
    .map(s => s.variantId)
    .filter(Boolean) as string[]

  const successfulOrders = data
    .flatMap(customer => customer?.orders ?? [])
    .filter(order => order?.status === 'succeeded')
    .map(order => order.variantId)
    .filter(Boolean) as string[]

  const availablePlans = [
    ...activeEntitlements.map(e =>
      e.variantId ? findPlanByVariantId(e.variantId).plan : e.id ? findPlanById(e.id as BillingPlan) : null
    ),
    ...activeSubscriptions.map(id => findPlanByVariantId(id).plan),
    ...successfulOrders.map(id => findPlanByVariantId(id).plan)
  ].filter(Boolean) as { id: BillingPlan }[]

  if (!availablePlans.length) return BillingPlan.FREE

  const sorted = availablePlans.sort((a, b) => findPlanIndexById(a.id) - findPlanIndexById(b.id))
  return sorted[sorted.length - 1]?.id ?? BillingPlan.FREE
}
