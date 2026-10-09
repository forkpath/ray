import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetUserMembershipsReq, GetUserMembershipsRes } from '@libs/payload'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

export class ListUserMembershipsQuery {
  constructor(
    public readonly userId: string,
    public readonly params: GetUserMembershipsReq
  ) {}
}

@QueryHandler(ListUserMembershipsQuery)
export class ListUserMembershipsHandler implements IQueryHandler<ListUserMembershipsQuery, GetUserMembershipsRes> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(query: ListUserMembershipsQuery): Promise<GetUserMembershipsRes> {
    const r = await this.userRepository.findMemberships(
      UserId.create(query.userId),
      UserMapper.toListMembershipsCriteria(query.params)
    )
    return { list: r.list, total: r.total } as unknown as GetUserMembershipsRes
  }
}
