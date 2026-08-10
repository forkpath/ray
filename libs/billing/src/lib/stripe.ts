import type { BillingCheckoutInput, BillingPortalInput } from '@libs/billing-contract'

import Stripe from 'stripe'

import { BillingModel, BillingOrderStatus, BillingProvider, BillingSubscriptionStatus } from '@libs/billing-contract'

import { serverEnv } from '../env'
import { billingConfig } from './config'
import {
  createWebhookEvent,
  findWebhookEvent,
  getBillingCustomerByExternalId,
  upsertBillingCustomer,
  upsertBillingOrder,
  upsertBillingSubscription
} from './server'
import { findBillingVariant, findBillingVariantByStripePriceId } from './utils'

let stripeClient: Stripe | null = null

function getStripeClient(): Stripe {
  if (!serverEnv.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(serverEnv.STRIPE_SECRET_KEY)
  }

  return stripeClient
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
  switch (status) {
    case 'trialing':
      return BillingSubscriptionStatus.TRIALING
    case 'active':
      return BillingSubscriptionStatus.ACTIVE
    case 'past_due':
      return BillingSubscriptionStatus.PAST_DUE
    case 'unpaid':
      return BillingSubscriptionStatus.UNPAID
    case 'paused':
      return BillingSubscriptionStatus.PAUSED
    case 'incomplete':
      return BillingSubscriptionStatus.INCOMPLETE
    case 'incomplete_expired':
      return BillingSubscriptionStatus.INCOMPLETE_EXPIRED
    case 'canceled':
    default:
      return BillingSubscriptionStatus.CANCELED
  }
}

function mapStripePaymentStatus(status: Stripe.Checkout.Session.PaymentStatus) {
  switch (status) {
    case 'paid':
      return BillingOrderStatus.SUCCEEDED
    case 'unpaid':
      return BillingOrderStatus.PENDING
    case 'no_payment_required':
      return BillingOrderStatus.SUCCEEDED
    default:
      return BillingOrderStatus.FAILED
  }
}

async function createOrRetrieveStripeCustomer(input: { referenceId: string; email: string }) {
  const stripe = getStripeClient()
  const existingCustomers = await stripe.customers.list({
    email: input.email,
    limit: 1
  })

  const stripeCustomer =
    existingCustomers.data[0] ??
    (await stripe.customers.create({
      email: input.email,
      metadata: {
        referenceId: input.referenceId
      }
    }))

  const customer = await upsertBillingCustomer({
    referenceId: input.referenceId,
    provider: BillingProvider.STRIPE,
    externalId: stripeCustomer.id
  })

  return {
    stripeCustomer,
    customer
  }
}

export async function createStripeCheckoutSession(input: BillingCheckoutInput) {
  const stripe = getStripeClient()
  const variant = findBillingVariant(input.variantId)

  if (!variant) {
    throw new Error(`Unknown billing variant: ${input.variantId}`)
  }

  if (!variant.stripePriceId) {
    throw new Error(`Stripe price is not configured for variant: ${input.variantId}`)
  }

  const { stripeCustomer } = await createOrRetrieveStripeCustomer({
    referenceId: input.referenceId,
    email: input.email
  })

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomer.id,
    mode: variant.model === BillingModel.RECURRING ? 'subscription' : 'payment',
    billing_address_collection: 'required',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: [
      {
        price: variant.stripePriceId,
        quantity: 1
      }
    ],
    customer_update: {
      address: 'auto'
    },
    metadata: {
      referenceId: input.referenceId,
      variantId: variant.id
    },
    ...(variant.trialDays && variant.model === BillingModel.RECURRING
      ? {
          subscription_data: {
            trial_period_days: variant.trialDays,
            metadata: {
              referenceId: input.referenceId,
              variantId: variant.id
            }
          }
        }
      : {})
  })

  return {
    provider: BillingProvider.STRIPE,
    url: session.url
  }
}

export async function createStripeBillingPortalSession(input: BillingPortalInput) {
  const stripe = getStripeClient()
  const { stripeCustomer } = await createOrRetrieveStripeCustomer({
    referenceId: input.referenceId,
    email: input.email
  })

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomer.id,
    return_url: input.returnUrl
  })

  return {
    provider: BillingProvider.STRIPE,
    url: session.url
  }
}

async function syncStripeSubscription(input: { stripeSubscription: Stripe.Subscription; stripeCustomerId: string }) {
  const customer = await getBillingCustomerByExternalId(input.stripeCustomerId, BillingProvider.STRIPE)

  if (!customer) {
    return
  }

  const priceId = input.stripeSubscription.items.data[0]?.price.id
  const variant = priceId ? findBillingVariantByStripePriceId(priceId) : undefined

  if (!variant) {
    return
  }

  const item = input.stripeSubscription.items.data[0]

  await upsertBillingSubscription({
    customerId: customer.id,
    externalId: input.stripeSubscription.id,
    variantId: variant.id,
    status: mapStripeSubscriptionStatus(input.stripeSubscription.status),
    store: BillingProvider.STRIPE,
    periodStartsAt: item?.current_period_start ? new Date(item.current_period_start * 1000) : new Date(),
    periodEndsAt: item?.current_period_end ? new Date(item.current_period_end * 1000) : new Date(),
    trialStartsAt: input.stripeSubscription.trial_start ? new Date(input.stripeSubscription.trial_start * 1000) : null,
    trialEndsAt: input.stripeSubscription.trial_end ? new Date(input.stripeSubscription.trial_end * 1000) : null
  })
}

async function syncStripeCheckout(input: { checkoutSession: Stripe.Checkout.Session }) {
  const stripeCustomerId = typeof input.checkoutSession.customer === 'string' ? input.checkoutSession.customer : null

  if (!stripeCustomerId) {
    return
  }

  const customer = await getBillingCustomerByExternalId(stripeCustomerId, BillingProvider.STRIPE)

  if (!customer) {
    return
  }

  const variantId = input.checkoutSession.metadata?.['variantId']

  if (!variantId) {
    return
  }

  await upsertBillingOrder({
    customerId: customer.id,
    externalId: input.checkoutSession.id,
    variantId,
    status: mapStripePaymentStatus(input.checkoutSession.payment_status),
    store: BillingProvider.STRIPE
  })
}

export async function handleStripeWebhook(input: { payload: string | Buffer; signature: string }) {
  const stripe = getStripeClient()

  if (!serverEnv.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }

  const event = stripe.webhooks.constructEvent(input.payload, input.signature, serverEnv.STRIPE_WEBHOOK_SECRET)

  const existing = await findWebhookEvent(event.id, BillingProvider.STRIPE)
  if (existing) {
    return { received: true, type: event.type, status: 'duplicate' }
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const stripeCustomerId = typeof subscription.customer === 'string' ? subscription.customer : ''
        await syncStripeSubscription({
          stripeSubscription: subscription,
          stripeCustomerId
        })
        break
      }
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed': {
        await syncStripeCheckout({
          checkoutSession: event.data.object as Stripe.Checkout.Session
        })
        break
      }
      default: {
        await createWebhookEvent({
          eventId: event.id,
          provider: BillingProvider.STRIPE,
          type: event.type,
          status: 'skipped'
        })
        return { received: true, type: event.type, status: 'skipped' }
      }
    }

    await createWebhookEvent({
      eventId: event.id,
      provider: BillingProvider.STRIPE,
      type: event.type,
      status: 'processed'
    })

    return { received: true, type: event.type, status: 'processed' }
  } catch (error) {
    await createWebhookEvent({
      eventId: event.id,
      provider: BillingProvider.STRIPE,
      type: event.type,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    }).catch(() => undefined)

    throw error
  }
}

export function getBillingCatalog() {
  return billingConfig
}
