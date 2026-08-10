import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'

import { AllowAnonymous, Session } from '@libs/srv-shared'

import {
  CreateBillingPortalCommand,
  CreateOrganizationBillingPortalCommand
} from '#/application/commands/billing/create-billing-portal.command'
import {
  CreateCheckoutSessionCommand,
  CreateOrganizationCheckoutSessionCommand
} from '#/application/commands/billing/create-checkout-session.command'
import { HandleRevenueCatWebhookCommand } from '#/application/commands/billing/handle-revenuecat-webhook.command'
import { HandleStripeWebhookCommand } from '#/application/commands/billing/handle-stripe-webhook.command'
import { BillingPortalDto, CheckoutDto } from '#/application/dtos/billing/billing.dto'
import {
  GetBillingSummaryQuery,
  GetOrganizationBillingSummaryQuery
} from '#/application/queries/billing/get-billing-summary.query'

interface SessionUser {
  id: string
  email: string
  name: string
  role?: string
}

interface AuthSession {
  user: SessionUser
}

@Controller('billing')
export class BillingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Get('me')
  async getSummary(@Session() session: AuthSession) {
    return this.queryBus.execute(new GetBillingSummaryQuery({ kind: 'user', userId: session.user.id }))
  }

  @Post('checkout')
  async createCheckoutSession(@Session() session: AuthSession, @Body() dto: CheckoutDto) {
    return this.commandBus.execute(
      new CreateCheckoutSessionCommand({
        owner: { kind: 'user', userId: session.user.id },
        email: session.user.email,
        variantId: dto.variantId,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl
      })
    )
  }

  @Post('portal')
  async createBillingPortal(@Session() session: AuthSession, @Body() dto: BillingPortalDto) {
    return this.commandBus.execute(
      new CreateBillingPortalCommand({
        owner: { kind: 'user', userId: session.user.id },
        email: session.user.email,
        returnUrl: dto.returnUrl
      })
    )
  }

  @Post('webhook/stripe')
  @AllowAnonymous()
  async handleStripeWebhookRequest(
    @Req() req: { body: Buffer | string },
    @Headers('stripe-signature') signature?: string
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header')
    }

    if (!Buffer.isBuffer(req.body) && typeof req.body !== 'string') {
      throw new BadRequestException('Webhook payload must be raw')
    }

    return this.commandBus.execute(
      new HandleStripeWebhookCommand({
        payload: req.body,
        signature
      })
    )
  }

  @Post('webhook/revenuecat')
  @AllowAnonymous()
  async handleRevenueCatWebhookRequest(
    @Req() req: { body: Buffer | string | Record<string, unknown> },
    @Headers('authorization') authorization?: string
  ) {
    return this.commandBus.execute(
      new HandleRevenueCatWebhookCommand({
        payload: req.body,
        authorization
      })
    )
  }
}

@Controller('organizations/:organizationId/billing')
export class OrganizationBillingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Get()
  async getSummary(@Param('organizationId') organizationId: string, @Session() session: AuthSession) {
    return this.queryBus.execute(new GetOrganizationBillingSummaryQuery(organizationId, session.user.id))
  }

  @Post('checkout')
  async createCheckoutSession(
    @Param('organizationId') organizationId: string,
    @Session() session: AuthSession,
    @Body() dto: CheckoutDto
  ) {
    return this.commandBus.execute(
      new CreateOrganizationCheckoutSessionCommand(
        organizationId,
        { userId: session.user.id, email: session.user.email },
        dto
      )
    )
  }

  @Post('portal')
  async createBillingPortal(
    @Param('organizationId') organizationId: string,
    @Session() session: AuthSession,
    @Body() dto: BillingPortalDto
  ) {
    return this.commandBus.execute(
      new CreateOrganizationBillingPortalCommand(
        organizationId,
        { userId: session.user.id, email: session.user.email },
        dto
      )
    )
  }
}
