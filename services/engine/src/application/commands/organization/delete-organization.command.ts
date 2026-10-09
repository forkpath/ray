import type { ICommandHandler } from '@nestjs/cqrs'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { DeleteOrganizationUseCase } from '~/application/use-cases/organization/delete-organization.usecase'
import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'

export class DeleteOrganizationCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(DeleteOrganizationCommand)
export class DeleteOrganizationHandler implements ICommandHandler<DeleteOrganizationCommand, void> {
  private readonly useCase: DeleteOrganizationUseCase

  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository
  ) {
    this.useCase = new DeleteOrganizationUseCase(this.orgRepository)
  }

  async execute(command: DeleteOrganizationCommand): Promise<void> {
    await this.useCase.execute({ organizationId: command.id })
  }
}
