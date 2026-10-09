import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetUsersReq, GetUsersRes } from '@libs/payload'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'

/**
 * 获取用户列表查询
 */
export class ListUsersQuery {
  constructor(public readonly params: GetUsersReq) {}
}

@QueryHandler(ListUsersQuery)
export class ListUsersHandler implements IQueryHandler<ListUsersQuery, GetUsersRes> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(query: ListUsersQuery): Promise<GetUsersRes> {
    const result = await this.userRepository.findMany(UserMapper.toListUsersCriteria(query.params))
    return UserMapper.toUsersResponse(result)
  }
}
