import { MobileStore } from '@libs/billing-contract'
import { BillingOrderStatus, BillingProvider, BillingSubscriptionStatus } from '@libs/common'

import {
  createWebhookEvent,
  findWebhookEvent,
  upsertBillingCustomer,
  upsertBillingOrder,
  upsertBillingSubscription
} from './server'

const RELEVANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'UNCANCELLATION',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'SUBSCRIPTION_PAUSED',
  'BILLING_ISSUE',
  'CANCELLATION',
  'EXPIRATION'
])

interface RevenueCatEvent {
  id?: string
  type: string
  app_user_id: string
  product_id: string
  transaction_id?: string
  original_transaction_id?: string
  store?: string
  period_type?: string
  purchased_at_ms?: number
  expiration_at_ms?: number | null
}

interface RevenueCatSubscription {
  original_transaction_id?: string | null
  store_transaction_id?: string | null
  period_type?: string | null
  purchase_date?: string | null
  original_purchase_date?: string | null
  expires_date?: string | null
  store: string
  refunded_at?: string | null
  auto_resume_date?: string | null
  billing_issues_detected_at?: string | null
  grace_period_expires_date?: string | null
}

interface RevenueCatPurchase {
  original_transaction_id?: string | null
  store_transaction_id?: string | null
  purchase_date?: string | null
  refunded_at?: string | null
  store: string
}

interface RevenueCatSubscriber {
  subscriptions?: Record<string, RevenueCatSubscription>
  non_subscriptions?: Record<string, RevenueCatPurchase[]>
}

const isInPast = (value: string | null | undefined) => (value ? new Date(value).getTime() < Date.now() : false)
const isInFuture = (value: string | null | undefined) => (value ? new Date(value).getTime() > Date.now() : false)

const toSubscriptionStatus = (subscription: RevenueCatSubscription): BillingSubscriptionStatus => {
  if (subscription.refunded_at) return BillingSubscriptionStatus.CANCELED
  if (subscription.auto_resume_date) return BillingSubscriptionStatus.PAUSED
  if (subscription.billing_issues_detected_at) {
    if (isInFuture(subscription.grace_period_expires_date)) return BillingSubscriptionStatus.PAST_DUE
    return BillingSubscriptionStatus.UNPAID
  }
  if (subscription.expires_date && isInPast(subscription.expires_date)) return BillingSubscriptionStatus.CANCELED
  if (subscription.period_type === 'trial') return BillingSubscriptionStatus.TRIALING
  if (!subscription.expires_date) return BillingSubscriptionStatus.INCOMPLETE
  return BillingSubscriptionStatus.ACTIVE
}

const toPaymentStatus = (purchase: RevenueCatPurchase): BillingOrderStatus => {
  if (purchase.refunded_at) return BillingOrderStatus.FAILED
  if (purchase.purchase_date) return BillingOrderStatus.SUCCEEDED
  return BillingOrderStatus.PENDING
}

const mapStore = (store?: string): string => {
  if (!store) return MobileStore.APP_STORE
  const normalized = store.toLowerCase()
  if (normalized.includes('play')) return MobileStore.PLAY_STORE
  return MobileStore.APP_STORE
}

async function fetchSubscriber(appUserId: string): Promise<RevenueCatSubscriber> {
  const apiKey = process.env['REVENUECAT_API_KEY']
  if (!apiKey) {
    return {}
  }

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${apiKey}`
    }
  })

  if (!res.ok) return {}

  const data = (await res.json()) as { subscriber?: RevenueCatSubscriber }
  return data.subscriber ?? {}
}

export interface WebhookCallbacks {
  onEvent?: (payload: unknown) => Promise<void> | void
  onSubscriptionCreated?: (id: string) => Promise<void> | void
  onSubscriptionUpdated?: (id: string) => Promise<void> | void
  onSubscriptionDeleted?: (id: string) => Promise<void> | void
  onOneTimePurchaseSucceeded?: (id: string) => Promise<void> | void
}

export interface RevenueCatWebhookInput {
  payload: unknown
  authorization?: string | null
  callbacks?: WebhookCallbacks
}

export async function handleRevenueCatWebhook({ payload, authorization, callbacks }: RevenueCatWebhookInput) {
  const secret = process.env['REVENUECAT_WEBHOOK_SECRET']
  if (!secret || authorization !== secret) {
    throw new Error('Unauthorized RevenueCat webhook')
  }

  const body =
    typeof payload === 'string'
      ? (JSON.parse(payload) as { event: RevenueCatEvent })
      : Buffer.isBuffer(payload)
        ? (JSON.parse(payload.toString('utf8')) as { event: RevenueCatEvent })
        : (payload as { event: RevenueCatEvent })

  await callbacks?.onEvent?.(body)

  const event = body.event
  if (!event || !RELEVANT_EVENTS.has(event.type)) {
    return { received: true, skipped: true as const }
  }

  const eventId =
    event.id ?? `${event.type}:${event.transaction_id ?? event.app_user_id}:${event.purchased_at_ms ?? ''}`
  const existing = await findWebhookEvent(eventId, BillingProvider.REVENUECAT)
  if (existing && existing.status === 'processed') {
    return { received: true, duplicate: true as const }
  }

  try {
    const subscriber = await fetchSubscriber(event.app_user_id)

    const customer = await upsertBillingCustomer({
      referenceId: event.app_user_id,
      externalId: event.app_user_id,
      provider: BillingProvider.REVENUECAT
    })

    for (const [variantId, subscription] of Object.entries(subscriber.subscriptions ?? {})) {
      const transactionId = subscription.original_transaction_id ?? subscription.store_transaction_id
      if (!transactionId) continue

      const periodStartsAt = subscription.purchase_date ? new Date(subscription.purchase_date) : new Date()
      const periodEndsAt = subscription.expires_date ? new Date(subscription.expires_date) : new Date()

      await upsertBillingSubscription({
        customerId: customer.id,
        externalId: transactionId,
        variantId,
        status: toSubscriptionStatus(subscription),
        store: mapStore(subscription.store),
        periodStartsAt,
        periodEndsAt,
        trialStartsAt:
          subscription.period_type === 'trial' && subscription.original_purchase_date
            ? new Date(subscription.original_purchase_date)
            : null,
        trialEndsAt:
          subscription.period_type === 'trial' && subscription.expires_date ? new Date(subscription.expires_date) : null
      })
    }

    for (const [variantId, purchases] of Object.entries(subscriber.non_subscriptions ?? {})) {
      for (const purchase of purchases) {
        const transactionId = purchase.original_transaction_id ?? purchase.store_transaction_id
        if (!transactionId) continue

        await upsertBillingOrder({
          customerId: customer.id,
          externalId: transactionId,
          variantId,
          status: toPaymentStatus(purchase),
          store: mapStore(purchase.store)
        })
      }
    }

    const effectiveId =
      event.original_transaction_id ??
      event.transaction_id ??
      `${event.app_user_id}:${event.product_id}:${event.purchased_at_ms ?? ''}`

    if (event.type === 'INITIAL_PURCHASE') {
      await callbacks?.onSubscriptionCreated?.(effectiveId)
    } else if (event.type === 'CANCELLATION' || event.type === 'EXPIRATION') {
      await callbacks?.onSubscriptionDeleted?.(effectiveId)
    } else if (event.type === 'NON_RENEWING_PURCHASE') {
      await callbacks?.onOneTimePurchaseSucceeded?.(effectiveId)
    } else {
      await callbacks?.onSubscriptionUpdated?.(effectiveId)
    }

    await createWebhookEvent({
      eventId,
      provider: BillingProvider.REVENUECAT,
      type: event.type,
      status: 'processed'
    })

    return { received: true }
  } catch (error) {
    await createWebhookEvent({
      eventId,
      provider: BillingProvider.REVENUECAT,
      type: event.type,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}
