import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetOrganizationRes } from '@libs/payload'
import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { OrganizationMapper } from '~/application/mappers/organization.mapper'
import { OrganizationNotFoundException } from '~/domain/exceptions/organization.exception'
import { ORGANIZATION_REPOSITORY } from '~/domain/repositories/organization.repository.interface'
import { OrganizationId } from '~/domain/value-objects/organization-id.vo'

export class GetOrganizationQuery {
  constructor(public readonly id: string) {}
}

@QueryHandler(GetOrganizationQuery)
export class GetOrganizationHandler implements IQueryHandler<GetOrganizationQuery, GetOrganizationRes> {
  constructor(
    @Inject(ORGANIZATION_REPOSITORY)
    private readonly orgRepository: IOrganizationRepository
  ) {}

  async execute(query: GetOrganizationQuery): Promise<GetOrganizationRes> {
    const org = await this.orgRepository.findById(OrganizationId.create(query.id))
    if (!org) {
      throw new OrganizationNotFoundException(query.id)
    }
    return OrganizationMapper.toOrganizationDetail(org)
  }
}
