import type { ICommandHandler } from '@nestjs/cqrs'
import type { IBillingRepository } from '~/domain/repositories/billing.repository.interface'
import type { BillingOwner } from '~/domain/value-objects/billing-owner.vo'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { CreateBillingPortalUseCase } from '~/application/use-cases/billing/create-billing-portal.use-case'
import { BILLING_REPOSITORY } from '~/domain/repositories/billing.repository.interface'

export class CreateBillingPortalCommand {
  constructor(
    public readonly input: {
      actorUserId: string
      owner: BillingOwner
      email: string
      returnUrl: string
    }
  ) {}
}

@CommandHandler(CreateBillingPortalCommand)
export class CreateBillingPortalHandler implements ICommandHandler<CreateBillingPortalCommand> {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly repository: IBillingRepository
  ) {}

  execute(command: CreateBillingPortalCommand) {
    return new CreateBillingPortalUseCase(this.repository).execute(command.input)
  }
}
