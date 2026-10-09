import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetInvitationsReq, GetInvitationsRes } from '@libs/payload'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { OrganizationMapper } from '~/application/mappers/organization.mapper'
import { UserOrganizationAccessService } from '~/application/services/user-organization-access.service'
import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'

export class ListUserOrganizationInvitationsQuery {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly params: GetInvitationsReq
  ) {}
}

@QueryHandler(ListUserOrganizationInvitationsQuery)
export class ListUserOrganizationInvitationsHandler
  implements IQueryHandler<ListUserOrganizationInvitationsQuery, GetInvitationsRes>
{
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository,
    private readonly accessService: UserOrganizationAccessService
  ) {}

  async execute(query: ListUserOrganizationInvitationsQuery): Promise<GetInvitationsRes> {
    await this.accessService.ensureInvitationAccess(query.organizationId, query.userId)

    const result = await this.orgRepository.findInvitations(
      OrganizationId.create(query.organizationId),
      OrganizationMapper.toListInvitationsCriteria(query.params)
    )
    return {
      list: result.list.map(OrganizationMapper.toInvitationResponse),
      total: result.total
    }
  }
}
