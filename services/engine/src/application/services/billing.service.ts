import { Injectable } from '@nestjs/common'

import {
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  getBillingSummaryByReferenceId,
  handleRevenueCatWebhook,
  handleStripeWebhook
} from '@libs/billing-server'

@Injectable()
export class BillingService {
  getSummary(userId: string) {
    return getBillingSummaryByReferenceId(userId)
  }

  createCheckoutSession(input: {
    referenceId: string
    email: string
    variantId: string
    successUrl: string
    cancelUrl: string
  }) {
    return createStripeCheckoutSession(input)
  }

  createBillingPortal(input: { referenceId: string; email: string; returnUrl: string }) {
    return createStripeBillingPortalSession(input)
  }

  handleStripeWebhook(input: { payload: Buffer | string; signature: string }) {
    return handleStripeWebhook(input)
  }

  handleRevenueCatWebhook(input: { payload: Buffer | string | Record<string, unknown>; authorization?: string }) {
    return handleRevenueCatWebhook(input)
  }
}
