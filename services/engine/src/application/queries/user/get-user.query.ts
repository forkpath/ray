import type { IQueryHandler } from '@nestjs/cqrs'
import type { UserResponse } from '~/application/dtos/user/user.dto'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { UserNotFoundException } from '~/domain/exceptions/user.exception'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

/**
 * 获取单个用户查询
 */
export class GetUserQuery {
  constructor(public readonly id: string) {}
}

@QueryHandler(GetUserQuery)
export class GetUserHandler implements IQueryHandler<GetUserQuery, UserResponse> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(query: GetUserQuery): Promise<UserResponse> {
    const user = await this.userRepository.findById(UserId.create(query.id))
    if (!user) {
      throw new UserNotFoundException(query.id)
    }
    return UserMapper.toResponse(user)
  }
}
