import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'

import { AllowAnonymous, Session } from '@libs/auth-server/nest'

import { CreateBillingPortalCommand } from '~/application/commands/billing/create-billing-portal.command'
import { CreateCheckoutSessionCommand } from '~/application/commands/billing/create-checkout-session.command'
import { HandleRevenueCatWebhookCommand } from '~/application/commands/billing/handle-revenuecat-webhook.command'
import { HandleStripeWebhookCommand } from '~/application/commands/billing/handle-stripe-webhook.command'
import { BillingPortalDto, CheckoutDto } from '~/application/dtos/billing/billing.dto'
import { GetBillingSummaryQuery } from '~/application/queries/billing/get-billing-summary.query'
import { BillingOwner } from '~/domain/value-objects/billing-owner.vo'

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
    return this.queryBus.execute(new GetBillingSummaryQuery(session.user.id, BillingOwner.forUser(session.user.id)))
  }

  @Post('checkout')
  async createCheckoutSession(@Session() session: AuthSession, @Body() dto: CheckoutDto) {
    return this.commandBus.execute(
      new CreateCheckoutSessionCommand({
        actorUserId: session.user.id,
        owner: BillingOwner.forUser(session.user.id),
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
        actorUserId: session.user.id,
        owner: BillingOwner.forUser(session.user.id),
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
  getSummary(@Session() session: AuthSession, @Param('organizationId') organizationId: string) {
    return this.queryBus.execute(
      new GetBillingSummaryQuery(session.user.id, BillingOwner.forOrganization(organizationId))
    )
  }

  @Post('checkout')
  createCheckoutSession(
    @Session() session: AuthSession,
    @Param('organizationId') organizationId: string,
    @Body() dto: CheckoutDto
  ) {
    return this.commandBus.execute(
      new CreateCheckoutSessionCommand({
        actorUserId: session.user.id,
        owner: BillingOwner.forOrganization(organizationId),
        email: session.user.email,
        variantId: dto.variantId,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl
      })
    )
  }

  @Post('portal')
  createBillingPortal(
    @Session() session: AuthSession,
    @Param('organizationId') organizationId: string,
    @Body() dto: BillingPortalDto
  ) {
    return this.commandBus.execute(
      new CreateBillingPortalCommand({
        actorUserId: session.user.id,
        owner: BillingOwner.forOrganization(organizationId),
        email: session.user.email,
        returnUrl: dto.returnUrl
      })
    )
  }
}
