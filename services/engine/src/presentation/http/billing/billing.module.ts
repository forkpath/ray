import { Module } from '@nestjs/common'
import { CqrsModule } from '@nestjs/cqrs'

import {
  CreateBillingPortalHandler,
  CreateOrganizationBillingPortalHandler
} from '#/application/commands/billing/create-billing-portal.command'
import {
  CreateCheckoutSessionHandler,
  CreateOrganizationCheckoutSessionHandler
} from '#/application/commands/billing/create-checkout-session.command'
import { HandleRevenueCatWebhookHandler } from '#/application/commands/billing/handle-revenuecat-webhook.command'
import { HandleStripeWebhookHandler } from '#/application/commands/billing/handle-stripe-webhook.command'
import {
  GetBillingSummaryHandler,
  GetOrganizationBillingSummaryHandler
} from '#/application/queries/billing/get-billing-summary.query'
import { BillingService } from '#/application/services/billing.service'

import { OrganizationModule } from '../organization/organization.module'
import { BillingController, OrganizationBillingController } from './billing.controller'

@Module({
  imports: [CqrsModule, OrganizationModule],
  controllers: [BillingController, OrganizationBillingController],
  providers: [
    BillingService,
    GetBillingSummaryHandler,
    GetOrganizationBillingSummaryHandler,
    CreateCheckoutSessionHandler,
    CreateOrganizationCheckoutSessionHandler,
    CreateBillingPortalHandler,
    CreateOrganizationBillingPortalHandler,
    HandleStripeWebhookHandler,
    HandleRevenueCatWebhookHandler
  ]
})
export class BillingModule {}
