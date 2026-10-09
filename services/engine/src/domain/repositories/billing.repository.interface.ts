import type { BillingAccount, BillingRedirect } from '~/domain/entities/billing-account.entity'
import type { BillingOwner } from '~/domain/value-objects/billing-owner.vo'
import type { UserId } from '~/domain/value-objects/user-id.vo'

export const BILLING_REPOSITORY = Symbol('BILLING_REPOSITORY')

export interface BillingCheckoutCriteria {
  owner: BillingOwner
  email: string
  variantId: string
  successUrl: string
  cancelUrl: string
}

export interface BillingPortalCriteria {
  owner: BillingOwner
  email: string
  returnUrl: string
}

export interface IBillingRepository {
  getAccount(owner: BillingOwner): Promise<BillingAccount>
  getOrganizationMembershipRole(organizationId: string, actorId: UserId): Promise<string | null>
  isOrganizationBillingEnabled(): boolean
  createCheckout(criteria: BillingCheckoutCriteria): Promise<BillingRedirect>
  createPortal(criteria: BillingPortalCriteria): Promise<BillingRedirect>
  handleStripeWebhook(input: { payload: Buffer | string; signature: string }): Promise<Record<string, unknown>>
  handleRevenueCatWebhook(input: {
    payload: Buffer | string | Record<string, unknown>
    authorization?: string
  }): Promise<Record<string, unknown>>
}
