import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetMembersReq, GetMembersRes } from '@libs/payload'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { OrganizationMapper } from '~/application/mappers/organization.mapper'
import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'

export class ListMembersQuery {
  constructor(
    public readonly orgId: string,
    public readonly params: GetMembersReq
  ) {}
}

@QueryHandler(ListMembersQuery)
export class ListMembersHandler implements IQueryHandler<ListMembersQuery, GetMembersRes> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository
  ) {}

  async execute(query: ListMembersQuery): Promise<GetMembersRes> {
    const result = await this.orgRepository.findMembers(
      OrganizationId.create(query.orgId),
      OrganizationMapper.toListMembersCriteria(query.params)
    )
    return {
      list: result.list.map(OrganizationMapper.toMemberResponse),
      total: result.total
    }
  }
}
