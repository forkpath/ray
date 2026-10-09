import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetOrganizationsReq, GetOrganizationsRes } from '@libs/payload'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { OrganizationMapper } from '~/application/mappers/organization.mapper'
import { ListOrganizationsUseCase } from '~/application/use-cases/organization/list-organizations.usecase'

export class ListOrganizationsQuery {
  constructor(public readonly params: GetOrganizationsReq) {}
}

@QueryHandler(ListOrganizationsQuery)
export class ListOrganizationsHandler implements IQueryHandler<ListOrganizationsQuery, GetOrganizationsRes> {
  constructor(@Inject(ListOrganizationsUseCase) private readonly useCase: ListOrganizationsUseCase) {}

  async execute(query: ListOrganizationsQuery): Promise<GetOrganizationsRes> {
    const result = await this.useCase.execute(OrganizationMapper.toListOrganizationsCriteria(query.params))
    return OrganizationMapper.toOrganizationsResponse(result)
  }
}
