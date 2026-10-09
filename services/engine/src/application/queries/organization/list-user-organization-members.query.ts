import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetMembersReq, GetMembersRes } from '@libs/payload'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { OrganizationMapper } from '~/application/mappers/organization.mapper'
import { UserOrganizationAccessService } from '~/application/services/user-organization-access.service'
import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'

export class ListUserOrganizationMembersQuery {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly params: GetMembersReq
  ) {}
}

@QueryHandler(ListUserOrganizationMembersQuery)
export class ListUserOrganizationMembersHandler
  implements IQueryHandler<ListUserOrganizationMembersQuery, GetMembersRes>
{
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository,
    private readonly accessService: UserOrganizationAccessService
  ) {}

  async execute(query: ListUserOrganizationMembersQuery): Promise<GetMembersRes> {
    await this.accessService.ensureMember(query.organizationId, query.userId)

    const result = await this.orgRepository.findMembers(
      OrganizationId.create(query.organizationId),
      OrganizationMapper.toListMembersCriteria(query.params)
    )
    return {
      list: result.list.map(OrganizationMapper.toMemberResponse),
      total: result.total
    }
  }
}
