import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetUserOrdersReq, GetUserOrdersRes } from '@libs/payload'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

export class ListUserOrdersQuery {
  constructor(
    public readonly userId: string,
    public readonly params: GetUserOrdersReq
  ) {}
}

@QueryHandler(ListUserOrdersQuery)
export class ListUserOrdersHandler implements IQueryHandler<ListUserOrdersQuery, GetUserOrdersRes> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(query: ListUserOrdersQuery): Promise<GetUserOrdersRes> {
    const r = await this.userRepository.findOrders(
      UserId.create(query.userId),
      UserMapper.toListOrdersCriteria(query.params)
    )
    return { list: r.list, total: r.total }
  }
}
