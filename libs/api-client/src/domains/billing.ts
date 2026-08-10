/**
 * @deprecated Compatibility facade only. New consumers must import Billing
 * queries and mutations from @libs/billing-client so cache keys include owner identity.
 */
import type {
  BillingCustomerRecord,
  BillingOrderRecord,
  BillingSubscriptionRecord,
  BillingSummaryCustomer as SharedBillingSummaryCustomer
} from '@libs/billing-contract'
import type { BillingPortalReq, CheckoutReq } from '@libs/payload'

import { createMutationFactory, createQueryOptionsFactory } from '../lib/queries/factory'

export type BillingCustomer = BillingCustomerRecord
export type BillingSubscription = BillingSubscriptionRecord
export type BillingOrder = BillingOrderRecord
export type BillingSummaryCustomer = SharedBillingSummaryCustomer
export type BillingSummary = BillingSummaryCustomer[]

export const billingKeys = {
  all: ['billing'] as const,
  summary: () => [...billingKeys.all, 'summary'] as const
} as const

export const billingQueries = {
  summary: createQueryOptionsFactory<BillingSummary, Error, BillingSummary>(api => ({
    queryKey: billingKeys.summary(),
    queryFn: () => api.get('/billing/me')
  }))
}

export const billingMutations = {
  checkout: createMutationFactory<{ provider: 'stripe'; url: string | null }, Error, CheckoutReq>((api, data) =>
    api.post('/billing/checkout', data)
  ),
  portal: createMutationFactory<{ provider: 'stripe'; url: string }, Error, BillingPortalReq>((api, data) =>
    api.post('/billing/portal', data)
  )
}
