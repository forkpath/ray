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

export interface OrganizationBillingScope {
  kind: 'organization'
  organizationId: string | null
}

export type BillingScope = UserBillingScope | OrganizationBillingScope

export interface OrganizationCheckoutVariables {
  scope: OrganizationBillingScope
  request: CheckoutReq
}

export interface OrganizationPortalVariables {
  scope: OrganizationBillingScope
  request: BillingPortalReq
}

const requireUserId = (scope: UserBillingScope): string => {
  if (!scope.userId) {
    throw new Error('Billing summary requires an authenticated user scope')
  }

  return scope.userId
}

const requireOrganizationId = (scope: OrganizationBillingScope): string => {
  if (!scope.organizationId) {
    throw new Error('Organization billing requires an organization scope')
  }

  return scope.organizationId
}

const getSummaryPath = (scope: BillingScope): string => {
  if (scope.kind === 'user') {
    requireUserId(scope)
    return '/billing/me'
  }

  return `/organizations/${encodeURIComponent(requireOrganizationId(scope))}/billing`
}

export const billingKeys = {
  all: ['billing'] as const,
  owner: (scope: BillingScope) =>
    [...billingKeys.all, 'owner', scope.kind, scope.kind === 'user' ? scope.userId : scope.organizationId] as const,
  summary: (scope: BillingScope) => [...billingKeys.owner(scope), 'summary'] as const
} as const

export const billingQueries = {
  summary: createQueryOptionsWithParams<BillingSummary, Error, BillingSummary, BillingScope>((api, scope) => ({
    queryKey: billingKeys.summary(scope),
    queryFn: () => api.get(getSummaryPath(scope))
  }))
}

export const billingMutations = {
  checkout: createMutationFactory<{ provider: 'stripe'; url: string | null }, Error, CheckoutReq>((api, data) =>
    api.post('/billing/checkout', checkoutReqSchema.parse(data))
  ),
  portal: createMutationFactory<{ provider: 'stripe'; url: string }, Error, BillingPortalReq>((api, data) =>
    api.post('/billing/portal', billingPortalReqSchema.parse(data))
  ),
  organizationCheckout: createMutationFactory<
    { provider: 'stripe'; url: string | null },
    Error,
    OrganizationCheckoutVariables
  >((api, variables) => {
    const organizationId = requireOrganizationId(variables.scope)
    return api.post(
      `/organizations/${encodeURIComponent(organizationId)}/billing/checkout`,
      checkoutReqSchema.parse(variables.request)
    )
  }),
  organizationPortal: createMutationFactory<{ provider: 'stripe'; url: string }, Error, OrganizationPortalVariables>(
    (api, variables) => {
      const organizationId = requireOrganizationId(variables.scope)
      return api.post(
        `/organizations/${encodeURIComponent(organizationId)}/billing/portal`,
        billingPortalReqSchema.parse(variables.request)
      )
    }
  )
}
