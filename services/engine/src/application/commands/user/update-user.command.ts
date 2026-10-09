import type { ICommandHandler } from '@nestjs/cqrs'
import type { UserResponse } from '~/application/dtos/user/user.dto'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { UserRole } from '~/domain/entities/user.entity'
import { UserNotFoundException } from '~/domain/exceptions/user.exception'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

export interface UpdateUserData {
  name?: string
  image?: string | null
  role?: UserRole
}

/**
 * 更新用户命令
 */
export class UpdateUserCommand {
  constructor(
    public readonly id: string,
    public readonly data: UpdateUserData
  ) {}
}

@CommandHandler(UpdateUserCommand)
export class UpdateUserHandler implements ICommandHandler<UpdateUserCommand, UserResponse> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(command: UpdateUserCommand): Promise<UserResponse> {
    const userId = UserId.create(command.id)
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundException(command.id)
    }
    user.changeProfile({ name: command.data.name, image: command.data.image })
    const updatedUser = await this.userRepository.update(userId, command.data)
    return UserMapper.toResponse(updatedUser)
  }
}
