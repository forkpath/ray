import type { ICommandHandler } from '@nestjs/cqrs'
import type { IBillingRepository } from '~/domain/repositories/billing.repository.interface'
import type { BillingOwner } from '~/domain/value-objects/billing-owner.vo'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { CreateBillingCheckoutUseCase } from '~/application/use-cases/billing/create-billing-checkout.use-case'
import { BILLING_REPOSITORY } from '~/domain/repositories/billing.repository.interface'

export class CreateCheckoutSessionCommand {
  constructor(
    public readonly input: {
      actorUserId: string
      owner: BillingOwner
      email: string
      variantId: string
      successUrl: string
      cancelUrl: string
    }
  ) {}
}

@CommandHandler(CreateCheckoutSessionCommand)
export class CreateCheckoutSessionHandler implements ICommandHandler<CreateCheckoutSessionCommand> {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly repository: IBillingRepository
  ) {}

  execute(command: CreateCheckoutSessionCommand) {
    return new CreateBillingCheckoutUseCase(this.repository).execute(command.input)
  }
}
