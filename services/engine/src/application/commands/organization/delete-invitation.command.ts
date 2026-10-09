import type { ICommandHandler } from '@nestjs/cqrs'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { DeleteInvitationUseCase } from '~/application/use-cases/organization/delete-invitation.usecase'
import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'

export class DeleteInvitationCommand {
  constructor(
    public readonly orgId: string,
    public readonly invitationId: string
  ) {}
}

@CommandHandler(DeleteInvitationCommand)
export class DeleteInvitationHandler implements ICommandHandler<DeleteInvitationCommand, void> {
  private readonly useCase: DeleteInvitationUseCase

  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository
  ) {
    this.useCase = new DeleteInvitationUseCase(this.orgRepository)
  }

  async execute(command: DeleteInvitationCommand): Promise<void> {
    await this.useCase.execute({
      organizationId: command.orgId,
      invitationId: command.invitationId
    })
  }
}
