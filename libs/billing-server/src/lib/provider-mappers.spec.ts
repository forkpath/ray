import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BillingOrderStatus, BillingSubscriptionStatus, MobileStore } from '@libs/billing-contract'

import { mapStore, toPaymentStatus, toSubscriptionStatus } from './revenuecat'
import { mapStripePaymentStatus, mapStripeSubscriptionStatus } from './stripe'

vi.mock('./persistence', () => ({
  createWebhookEvent: vi.fn(),
  findWebhookEvent: vi.fn(),
  getBillingCustomerByExternalId: vi.fn(),
  upsertBillingCustomer: vi.fn(),
  upsertBillingOrder: vi.fn(),
  upsertBillingSubscription: vi.fn()
}))

describe('Billing provider mappers', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it.each([
    ['trialing', BillingSubscriptionStatus.TRIALING],
    ['active', BillingSubscriptionStatus.ACTIVE],
    ['past_due', BillingSubscriptionStatus.PAST_DUE],
    ['canceled', BillingSubscriptionStatus.CANCELED]
  ] as const)('maps Stripe subscription status %s', (input, expected) => {
    expect(mapStripeSubscriptionStatus(input)).toBe(expected)
  })

  it.each([
    ['paid', BillingOrderStatus.SUCCEEDED],
    ['unpaid', BillingOrderStatus.PENDING],
    ['no_payment_required', BillingOrderStatus.SUCCEEDED]
  ] as const)('maps Stripe payment status %s', (input, expected) => {
    expect(mapStripePaymentStatus(input)).toBe(expected)
  })

  it('normalizes RevenueCat stores', () => {
    expect(mapStore()).toBe(MobileStore.APP_STORE)
    expect(mapStore('app_store')).toBe(MobileStore.APP_STORE)
    expect(mapStore('play_store')).toBe(MobileStore.PLAY_STORE)
  })

  it('maps RevenueCat subscription lifecycle states', () => {
    expect(
      toSubscriptionStatus({
        store: 'app_store',
        refunded_at: '2026-01-01T00:00:00.000Z'
      })
    ).toBe(BillingSubscriptionStatus.CANCELED)
    expect(
      toSubscriptionStatus({
        store: 'app_store',
        period_type: 'trial',
        expires_date: '2999-01-01T00:00:00.000Z'
      })
    ).toBe(BillingSubscriptionStatus.TRIALING)
    expect(
      toSubscriptionStatus({
        store: 'play_store',
        expires_date: '2999-01-01T00:00:00.000Z'
      })
    ).toBe(BillingSubscriptionStatus.ACTIVE)
  })

  it('maps RevenueCat one-time purchase states', () => {
    expect(toPaymentStatus({ store: 'app_store', refunded_at: '2026-01-01T00:00:00.000Z' })).toBe(
      BillingOrderStatus.FAILED
    )
    expect(toPaymentStatus({ store: 'app_store', purchase_date: '2026-01-01T00:00:00.000Z' })).toBe(
      BillingOrderStatus.SUCCEEDED
    )
    expect(toPaymentStatus({ store: 'app_store' })).toBe(BillingOrderStatus.PENDING)
  })
})
