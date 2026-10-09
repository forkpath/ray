import type { ICommandHandler } from '@nestjs/cqrs'
import type { IBillingRepository } from '~/domain/repositories/billing.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { HandleStripeWebhookUseCase } from '~/application/use-cases/billing/handle-billing-webhooks.use-case'
import { BILLING_REPOSITORY } from '~/domain/repositories/billing.repository.interface'

export class HandleStripeWebhookCommand {
  constructor(
    public readonly input: {
      payload: Buffer | string
      signature: string
    }
  ) {}
}

@CommandHandler(HandleStripeWebhookCommand)
export class HandleStripeWebhookHandler implements ICommandHandler<HandleStripeWebhookCommand> {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly repository: IBillingRepository
  ) {}

  execute(command: HandleStripeWebhookCommand) {
    return new HandleStripeWebhookUseCase(this.repository).execute(command.input)
  }
}
