import type { IQueryHandler } from '@nestjs/cqrs'
import type { UserSessionResponse } from '~/application/dtos/user/user.dto'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

/**
 * 获取用户会话列表查询
 */
export class GetUserSessionsQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetUserSessionsQuery)
export class GetUserSessionsHandler implements IQueryHandler<GetUserSessionsQuery, UserSessionResponse[]> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(query: GetUserSessionsQuery): Promise<UserSessionResponse[]> {
    return this.userRepository.getSessions(UserId.create(query.userId))
  }
}
