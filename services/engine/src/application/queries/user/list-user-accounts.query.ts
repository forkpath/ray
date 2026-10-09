import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetUserAccountsReq, GetUserAccountsRes } from '@libs/payload'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

export class ListUserAccountsQuery {
  constructor(
    public readonly userId: string,
    public readonly params: GetUserAccountsReq
  ) {}
}

@QueryHandler(ListUserAccountsQuery)
export class ListUserAccountsHandler implements IQueryHandler<ListUserAccountsQuery, GetUserAccountsRes> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(query: ListUserAccountsQuery): Promise<GetUserAccountsRes> {
    const r = await this.userRepository.findAccounts(
      UserId.create(query.userId),
      UserMapper.toListAccountsCriteria(query.params)
    )
    return { list: r.list, total: r.total }
  }
}
