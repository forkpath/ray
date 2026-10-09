import type { ICommandHandler } from '@nestjs/cqrs'
import type { UserResponse } from '~/application/dtos/user/user.dto'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { UserNotFoundException } from '~/domain/exceptions/user.exception'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

/**
 * 解封用户命令
 */
export class UnbanUserCommand {
  constructor(public readonly id: string) {}
}

@CommandHandler(UnbanUserCommand)
export class UnbanUserHandler implements ICommandHandler<UnbanUserCommand, UserResponse> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(command: UnbanUserCommand): Promise<UserResponse> {
    const userId = UserId.create(command.id)
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundException(command.id)
    }
    const unbannedUser = await this.userRepository.unban(userId)
    return UserMapper.toResponse(unbannedUser)
  }
}
