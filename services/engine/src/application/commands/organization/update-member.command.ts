import type { ICommandHandler } from '@nestjs/cqrs'
import type { GetMembersRes } from '@libs/payload'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { OrganizationMapper } from '~/application/mappers/organization.mapper'
import { UpdateMemberRoleUseCase } from '~/application/use-cases/organization/update-member-role.usecase'
import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'

type MemberResponse = GetMembersRes['list'][number]

export class UpdateMemberCommand {
  constructor(
    public readonly orgId: string,
    public readonly memberId: string,
    public readonly role: string
  ) {}
}

@CommandHandler(UpdateMemberCommand)
export class UpdateMemberHandler implements ICommandHandler<UpdateMemberCommand, MemberResponse> {
  private readonly useCase: UpdateMemberRoleUseCase

  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository
  ) {
    this.useCase = new UpdateMemberRoleUseCase(this.orgRepository)
  }

  async execute(command: UpdateMemberCommand): Promise<MemberResponse> {
    const result = await this.useCase.execute({
      organizationId: command.orgId,
      memberId: command.memberId,
      newRole: command.role
    })
    return OrganizationMapper.toMemberResponse(result.member)
  }
}
