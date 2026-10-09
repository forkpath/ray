import type { ICommandHandler } from '@nestjs/cqrs'
import type { IBillingRepository } from '~/domain/repositories/billing.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { HandleRevenueCatWebhookUseCase } from '~/application/use-cases/billing/handle-billing-webhooks.use-case'
import { BILLING_REPOSITORY } from '~/domain/repositories/billing.repository.interface'

export class HandleRevenueCatWebhookCommand {
  constructor(
    public readonly input: {
      payload: Buffer | string | Record<string, unknown>
      authorization?: string
    }
  ) {}
}

@CommandHandler(HandleRevenueCatWebhookCommand)
export class HandleRevenueCatWebhookHandler implements ICommandHandler<HandleRevenueCatWebhookCommand> {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly repository: IBillingRepository
  ) {}

  execute(command: HandleRevenueCatWebhookCommand) {
    return new HandleRevenueCatWebhookUseCase(this.repository).execute(command.input)
  }
}
