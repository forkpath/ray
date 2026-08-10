import type { ApiClient } from '@libs/api-client'
import type { BillingSummary } from '@libs/billing-contract'

import { describe, expect, it, vi } from 'vitest'

import { billingKeys, billingMutations, billingQueries } from './billing-client'

const createApi = () => {
  const get = vi.fn().mockResolvedValue([])
  const post = vi.fn().mockResolvedValue({ provider: 'stripe', url: 'https://billing.example.test' })

  return {
    api: { get, post } as unknown as ApiClient,
    get,
    post
  }
}

describe('billing client', () => {
  it('isolates cached summaries by owner kind and user id', () => {
    const first = { kind: 'user', userId: 'user-1' } as const
    const second = { kind: 'user', userId: 'user-2' } as const

    expect(billingKeys.summary(first)).toEqual(['billing', 'owner', 'user', 'user-1', 'summary'])
    expect(billingKeys.summary(second)).not.toEqual(billingKeys.summary(first))
  })

  it('loads the personal summary without sending the owner id as request data', async () => {
    const { api, get } = createApi()
    const options = billingQueries.summary(api, { kind: 'user', userId: 'user-1' })
    const queryFn = options.queryFn as unknown as () => Promise<BillingSummary>

    await expect(queryFn()).resolves.toEqual([])
    expect(get).toHaveBeenCalledWith('/billing/me')
  })

  it('fails closed before a summary request when the session owner is missing', () => {
    const { api, get } = createApi()
    const options = billingQueries.summary(api, { kind: 'user', userId: null })
    const queryFn = options.queryFn as unknown as () => Promise<BillingSummary>

    expect(() => queryFn()).toThrow('authenticated user scope')
    expect(get).not.toHaveBeenCalled()
  })

  it('validates checkout requests with the shared payload schema', () => {
    const { api, post } = createApi()

    expect(() =>
      billingMutations.checkout.fn(api, {
        variantId: 'premium-monthly',
        successUrl: 'not-a-url',
        cancelUrl: 'https://app.example.test/billing'
      })
    ).toThrow()
    expect(post).not.toHaveBeenCalled()
  })

  it('posts validated portal requests to the existing user endpoint', async () => {
    const { api, post } = createApi()
    const input = { returnUrl: 'https://app.example.test/billing' }

    await billingMutations.portal.fn(api, input)
    expect(post).toHaveBeenCalledWith('/billing/portal', input)
  })
})
