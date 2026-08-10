import type { ICommandHandler } from '@nestjs/cqrs'
import type { BillingPortalInput } from '@libs/billing-contract'
import type { BillingPortalReq } from '@libs/payload'

import { CommandHandler } from '@nestjs/cqrs'

import { BillingService } from '../../services/billing.service'
import { UserOrganizationAccessService } from '../../services/user-organization-access.service'

export class CreateBillingPortalCommand {
  constructor(public readonly input: BillingPortalInput) {}
}

@CommandHandler(CreateBillingPortalCommand)
export class CreateBillingPortalHandler implements ICommandHandler<CreateBillingPortalCommand> {
  constructor(private readonly billingService: BillingService) {}

  execute(command: CreateBillingPortalCommand) {
    return this.billingService.createBillingPortal(command.input)
  }
}

export class CreateOrganizationBillingPortalCommand {
  constructor(
    public readonly organizationId: string,
    public readonly actor: { userId: string; email: string },
    public readonly request: BillingPortalReq
  ) {}
}

@CommandHandler(CreateOrganizationBillingPortalCommand)
export class CreateOrganizationBillingPortalHandler implements ICommandHandler<CreateOrganizationBillingPortalCommand> {
  constructor(
    private readonly billingService: BillingService,
    private readonly accessService: UserOrganizationAccessService
  ) {}

  async execute(command: CreateOrganizationBillingPortalCommand) {
    this.billingService.assertOrganizationBillingEnabled()
    await this.accessService.ensureBillingManagementAccess(command.organizationId, command.actor.userId)

    return this.billingService.createBillingPortal({
      owner: { kind: 'organization', organizationId: command.organizationId },
      email: command.actor.email,
      ...command.request
    })
  }
}
