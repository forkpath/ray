/**
 * Billing HTTP 客户端边界。归属只进入 Query Key，服务端仍从 Better Auth
 * Session 推导真实 owner，客户端不会把 userId 作为授权依据发送给接口。
 */
import type { BillingSummary } from '@libs/billing-contract'
import type { BillingPortalReq, CheckoutReq } from '@libs/payload'

import { createMutationFactory, createQueryOptionsWithParams } from '@libs/api-client'
import { billingPortalReqSchema, checkoutReqSchema } from '@libs/payload'

export interface UserBillingScope {
  kind: 'user'
  userId: string | null
}

const requireUserId = (scope: UserBillingScope): string => {
  if (!scope.userId) {
    throw new Error('Billing summary requires an authenticated user scope')
  }

  return scope.userId
}

export const billingKeys = {
  all: ['billing'] as const,
  owner: (scope: UserBillingScope) => [...billingKeys.all, 'owner', scope.kind, scope.userId] as const,
  summary: (scope: UserBillingScope) => [...billingKeys.owner(scope), 'summary'] as const
} as const

export const billingQueries = {
  summary: createQueryOptionsWithParams<BillingSummary, Error, BillingSummary, UserBillingScope>((api, scope) => ({
    queryKey: billingKeys.summary(scope),
    queryFn: () => {
      requireUserId(scope)
      return api.get('/billing/me')
    }
  }))
}

export const billingMutations = {
  checkout: createMutationFactory<{ provider: 'stripe'; url: string | null }, Error, CheckoutReq>((api, data) =>
    api.post('/billing/checkout', checkoutReqSchema.parse(data))
  ),
  portal: createMutationFactory<{ provider: 'stripe'; url: string }, Error, BillingPortalReq>((api, data) =>
    api.post('/billing/portal', billingPortalReqSchema.parse(data))
  )
}
