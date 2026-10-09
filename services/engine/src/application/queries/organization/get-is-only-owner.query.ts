import type { IQueryHandler } from '@nestjs/cqrs'
import type { IsOnlyOwnerRes } from '@libs/payload'

import { QueryHandler } from '@nestjs/cqrs'

import { UserOrganizationAccessService } from '~/application/services/user-organization-access.service'

export class GetIsOnlyOwnerQuery {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string
  ) {}
}

@QueryHandler(GetIsOnlyOwnerQuery)
export class GetIsOnlyOwnerHandler implements IQueryHandler<GetIsOnlyOwnerQuery, IsOnlyOwnerRes> {
  constructor(private readonly accessService: UserOrganizationAccessService) {}

  execute(query: GetIsOnlyOwnerQuery): Promise<IsOnlyOwnerRes> {
    return this.accessService.isOnlyOwner(query.organizationId, query.userId)
  }
}
