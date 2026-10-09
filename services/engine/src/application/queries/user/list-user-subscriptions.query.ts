import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetUserSubscriptionsReq, GetUserSubscriptionsRes } from '@libs/payload'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

export class ListUserSubscriptionsQuery {
  constructor(
    public readonly userId: string,
    public readonly params: GetUserSubscriptionsReq
  ) {}
}

@QueryHandler(ListUserSubscriptionsQuery)
export class ListUserSubscriptionsHandler
  implements IQueryHandler<ListUserSubscriptionsQuery, GetUserSubscriptionsRes>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(query: ListUserSubscriptionsQuery): Promise<GetUserSubscriptionsRes> {
    const r = await this.userRepository.findSubscriptions(
      UserId.create(query.userId),
      UserMapper.toListSubscriptionsCriteria(query.params)
    )
    return { list: r.list, total: r.total }
  }
}
