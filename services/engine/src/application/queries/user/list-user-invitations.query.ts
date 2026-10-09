import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetUserInvitationsReq, GetUserInvitationsRes } from '@libs/payload'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

export class ListUserInvitationsQuery {
  constructor(
    public readonly userId: string,
    public readonly params: GetUserInvitationsReq
  ) {}
}

@QueryHandler(ListUserInvitationsQuery)
export class ListUserInvitationsHandler implements IQueryHandler<ListUserInvitationsQuery, GetUserInvitationsRes> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(query: ListUserInvitationsQuery): Promise<GetUserInvitationsRes> {
    const r = await this.userRepository.findInvitations(
      UserId.create(query.userId),
      UserMapper.toListInvitationsCriteria(query.params)
    )
    return { list: r.list, total: r.total } as unknown as GetUserInvitationsRes
  }
}
