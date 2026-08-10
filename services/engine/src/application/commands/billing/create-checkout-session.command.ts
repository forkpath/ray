import type { ICommandHandler } from '@nestjs/cqrs'
import type { BillingCheckoutInput } from '@libs/billing-contract'
import type { CheckoutReq } from '@libs/payload'

import { CommandHandler } from '@nestjs/cqrs'

import { BillingService } from '../../services/billing.service'
import { UserOrganizationAccessService } from '../../services/user-organization-access.service'

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

export class CreateOrganizationCheckoutSessionCommand {
  constructor(
    public readonly organizationId: string,
    public readonly actor: { userId: string; email: string },
    public readonly request: CheckoutReq
  ) {}
}

@CommandHandler(CreateOrganizationCheckoutSessionCommand)
export class CreateOrganizationCheckoutSessionHandler
  implements ICommandHandler<CreateOrganizationCheckoutSessionCommand>
{
  constructor(
    private readonly billingService: BillingService,
    private readonly accessService: UserOrganizationAccessService
  ) {}

  async execute(command: CreateOrganizationCheckoutSessionCommand) {
    this.billingService.assertOrganizationBillingEnabled()
    await this.accessService.ensureBillingManagementAccess(command.organizationId, command.actor.userId)

    return this.billingService.createCheckoutSession({
      owner: { kind: 'organization', organizationId: command.organizationId },
      email: command.actor.email,
      ...command.request
    })
  }
}
