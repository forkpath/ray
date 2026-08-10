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

  it('isolates organization summaries from users and other organizations', () => {
    const user = { kind: 'user', userId: 'same-id' } as const
    const organization = { kind: 'organization', organizationId: 'same-id' } as const
    const otherOrganization = { kind: 'organization', organizationId: 'org-2' } as const

    expect(billingKeys.summary(organization)).toEqual(['billing', 'owner', 'organization', 'same-id', 'summary'])
    expect(billingKeys.summary(organization)).not.toEqual(billingKeys.summary(user))
    expect(billingKeys.summary(otherOrganization)).not.toEqual(billingKeys.summary(organization))
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

  it('loads an organization summary through the path owner without request data', async () => {
    const { api, get } = createApi()
    const options = billingQueries.summary(api, { kind: 'organization', organizationId: 'org/one' })
    const queryFn = options.queryFn as unknown as () => Promise<BillingSummary>

    await expect(queryFn()).resolves.toEqual([])
    expect(get).toHaveBeenCalledWith('/organizations/org%2Fone/billing')
  })

  it('fails closed before an organization request when its scope is missing', () => {
    const { api, get } = createApi()
    const options = billingQueries.summary(api, { kind: 'organization', organizationId: null })
    const queryFn = options.queryFn as unknown as () => Promise<BillingSummary>

    expect(() => queryFn()).toThrow('requires an organization scope')
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

  it('posts organization checkout without copying the owner into the body', async () => {
    const { api, post } = createApi()
    const request = {
      variantId: 'premium-monthly',
      successUrl: 'https://app.example.test/billing/success',
      cancelUrl: 'https://app.example.test/billing'
    }

    await billingMutations.organizationCheckout.fn(api, {
      scope: { kind: 'organization', organizationId: 'org-1' },
      request
    })

    expect(post).toHaveBeenCalledWith('/organizations/org-1/billing/checkout', request)
  })

  it('fails before an organization mutation when its path scope is missing', () => {
    const { api, post } = createApi()

    expect(() =>
      billingMutations.organizationCheckout.fn(api, {
        scope: { kind: 'organization', organizationId: null },
        request: {
          variantId: 'premium-monthly',
          successUrl: 'https://app.example.test/billing/success',
          cancelUrl: 'https://app.example.test/billing'
        }
      })
    ).toThrow('requires an organization scope')
    expect(post).not.toHaveBeenCalled()
  })

  it('posts organization portal without copying the owner into the body', async () => {
    const { api, post } = createApi()
    const request = { returnUrl: 'https://app.example.test/billing' }

    await billingMutations.organizationPortal.fn(api, {
      scope: { kind: 'organization', organizationId: 'org-1' },
      request
    })

    expect(post).toHaveBeenCalledWith('/organizations/org-1/billing/portal', request)
  })
})
