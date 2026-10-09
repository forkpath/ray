import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetInvitationsReq, GetInvitationsRes } from '@libs/payload'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { OrganizationMapper } from '~/application/mappers/organization.mapper'
import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'

export class ListInvitationsQuery {
  constructor(
    public readonly orgId: string,
    public readonly params: GetInvitationsReq
  ) {}
}

@QueryHandler(ListInvitationsQuery)
export class ListInvitationsHandler implements IQueryHandler<ListInvitationsQuery, GetInvitationsRes> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository
  ) {}

  async execute(query: ListInvitationsQuery): Promise<GetInvitationsRes> {
    const result = await this.orgRepository.findInvitations(
      OrganizationId.create(query.orgId),
      OrganizationMapper.toListInvitationsCriteria(query.params)
    )
    return {
      list: result.list.map(OrganizationMapper.toInvitationResponse),
      total: result.total
    }
  }
}
