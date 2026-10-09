import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import { CreateBillingPortalHandler } from '~/application/commands/billing/create-billing-portal.command'
import { CreateCheckoutSessionHandler } from '~/application/commands/billing/create-checkout-session.command'
import { HandleRevenueCatWebhookHandler } from '~/application/commands/billing/handle-revenuecat-webhook.command'
import { HandleStripeWebhookHandler } from '~/application/commands/billing/handle-stripe-webhook.command'
import { GetBillingSummaryHandler } from '~/application/queries/billing/get-billing-summary.query'
import { BILLING_REPOSITORY } from '~/domain/repositories/billing.repository.interface'
import { BillingRepository } from '~/infrastructure/repositories/billing.repository'

import { BillingController, OrganizationBillingController } from './billing.controller'

@Module({
  imports: [CqrsModule],
  controllers: [BillingController, OrganizationBillingController],
  providers: [
    {
      provide: BILLING_REPOSITORY,
      useClass: BillingRepository
    },
    GetBillingSummaryHandler,
    CreateCheckoutSessionHandler,
    CreateBillingPortalHandler,
    HandleStripeWebhookHandler,
    HandleRevenueCatWebhookHandler
  ]
})
export class BillingModule {}
