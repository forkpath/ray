import type { ICommandHandler } from '@nestjs/cqrs'
import type { BillingCheckoutInput } from '@libs/billing-contract'

import { CommandHandler } from '@nestjs/cqrs'

import { BillingService } from '../../services/billing.service'

export class CreateCheckoutSessionCommand {
  constructor(public readonly input: BillingCheckoutInput) {}
}

@CommandHandler(CreateCheckoutSessionCommand)
export class CreateCheckoutSessionHandler implements ICommandHandler<CreateCheckoutSessionCommand> {
  constructor(private readonly billingService: BillingService) {}

  execute(command: CreateCheckoutSessionCommand) {
    return this.billingService.createCheckoutSession(command.input)
  }
}
