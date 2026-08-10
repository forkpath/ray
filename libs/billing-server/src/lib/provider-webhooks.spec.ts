import type { WebhookEventIdentity } from './webhook-state-machine'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handleRevenueCatWebhook } from './revenuecat'
import { handleStripeWebhook } from './stripe'
import { WebhookEventProcessingError } from './webhook-state-machine'

const { constructEvent, runWebhookEvent } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  runWebhookEvent: vi.fn()
}))

vi.mock('stripe', () => ({
  default: class StripeClient {
    readonly webhooks = { constructEvent }
  }
}))

vi.mock('./env', () => ({
  serverEnv: {
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    REVENUECAT_WEBHOOK_SECRET: 'revenuecat-secret',
    REVENUECAT_API_KEY: ''
  }
}))

vi.mock('./persistence', () => ({
  getBillingCustomerByExternalId: vi.fn(),
  getBillingCustomersByOwner: vi.fn(),
  upsertBillingCustomer: vi.fn(),
  upsertBillingOrder: vi.fn(),
  upsertBillingSubscription: vi.fn()
}))

vi.mock('./webhook-state-machine', async importOriginal => ({
  ...(await importOriginal<typeof import('./webhook-state-machine')>()),
  runWebhookEvent
}))

describe('provider webhook state-machine integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('claims and records unsupported Stripe events as skipped', async () => {
    constructEvent.mockReturnValue({ id: 'evt-stripe', type: 'customer.created', data: { object: {} } })
    runWebhookEvent.mockImplementation(
      async (identity: WebhookEventIdentity, process: () => Promise<'processed' | 'skipped'>) => ({
        status: await process(),
        attemptCount: 1
      })
    )

    await expect(handleStripeWebhook({ payload: '{}', signature: 'signature' })).resolves.toEqual({
      received: true,
      type: 'customer.created',
      status: 'skipped'
    })
    expect(runWebhookEvent).toHaveBeenCalledWith(
      { eventId: 'evt-stripe', provider: 'stripe', type: 'customer.created' },
      expect.any(Function)
    )
  })

  it('returns a terminal Stripe duplicate without processing twice', async () => {
    constructEvent.mockReturnValue({ id: 'evt-stripe', type: 'checkout.session.completed', data: { object: {} } })
    runWebhookEvent.mockResolvedValue({ status: 'duplicate', terminalStatus: 'processed', attemptCount: 1 })

    await expect(handleStripeWebhook({ payload: '{}', signature: 'signature' })).resolves.toMatchObject({
      status: 'duplicate'
    })
  })

  it('rejects a concurrent Stripe delivery so the provider retries', async () => {
    constructEvent.mockReturnValue({ id: 'evt-stripe', type: 'checkout.session.completed', data: { object: {} } })
    runWebhookEvent.mockRejectedValue(
      new WebhookEventProcessingError(
        { eventId: 'evt-stripe', provider: 'stripe', type: 'checkout.session.completed' },
        1
      )
    )

    await expect(handleStripeWebhook({ payload: '{}', signature: 'signature' })).rejects.toBeInstanceOf(
      WebhookEventProcessingError
    )
  })

  it('records unsupported RevenueCat events as skipped after authorization', async () => {
    runWebhookEvent.mockImplementation(
      async (identity: WebhookEventIdentity, process: () => Promise<'processed' | 'skipped'>) => ({
        status: await process(),
        attemptCount: 1
      })
    )

    await expect(
      handleRevenueCatWebhook({
        authorization: 'revenuecat-secret',
        payload: {
          event: {
            id: 'evt-revenuecat',
            type: 'TEST',
            app_user_id: 'user-1',
            product_id: 'premium'
          }
        }
      })
    ).resolves.toEqual({ received: true, skipped: true })
    expect(runWebhookEvent).toHaveBeenCalledWith(
      { eventId: 'evt-revenuecat', provider: 'revenuecat', type: 'TEST' },
      expect.any(Function)
    )
  })

  it('does not invoke RevenueCat callbacks for terminal duplicate events', async () => {
    runWebhookEvent.mockResolvedValue({ status: 'duplicate', terminalStatus: 'processed', attemptCount: 2 })
    const onEvent = vi.fn()

    await expect(
      handleRevenueCatWebhook({
        authorization: 'revenuecat-secret',
        callbacks: { onEvent },
        payload: {
          event: {
            id: 'evt-revenuecat',
            type: 'INITIAL_PURCHASE',
            app_user_id: 'user-1',
            product_id: 'premium'
          }
        }
      })
    ).resolves.toEqual({ received: true, duplicate: true })
    expect(onEvent).not.toHaveBeenCalled()
  })
})
