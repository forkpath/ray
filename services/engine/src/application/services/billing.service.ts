import type { BillingCheckoutInput, BillingOwner, BillingPortalInput } from '@libs/billing-contract'

import { Injectable, NotFoundException } from '@nestjs/common'

import {
  billingOwnerFeatureFlags,
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  getBillingSummaryByOwner,
  handleRevenueCatWebhook,
  handleStripeWebhook
} from '@libs/billing-server'

@Injectable()
export class BillingService {
  getSummary(owner: BillingOwner) {
    return getBillingSummaryByOwner(owner)
  }

  createCheckoutSession(input: BillingCheckoutInput) {
    return createStripeCheckoutSession(input)
  }

  createBillingPortal(input: BillingPortalInput) {
    return createStripeBillingPortalSession(input)
  }

  assertOrganizationBillingEnabled() {
    if (!billingOwnerFeatureFlags.organizationBilling) {
      throw new NotFoundException('Organization billing is not enabled')
    }
  }

  handleStripeWebhook(input: { payload: Buffer | string; signature: string }) {
    return handleStripeWebhook(input)
  }

  handleRevenueCatWebhook(input: { payload: Buffer | string | Record<string, unknown>; authorization?: string }) {
    return handleRevenueCatWebhook(input)
  }
}
