import type { ICommandHandler } from '@nestjs/cqrs'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { UserNotFoundException } from '~/domain/exceptions/user.exception'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

/**
 * 设置用户密码命令（管理员操作）
 */
export class SetUserPasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly newPassword: string
  ) {}
}

@CommandHandler(SetUserPasswordCommand)
export class SetUserPasswordHandler implements ICommandHandler<SetUserPasswordCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(command: SetUserPasswordCommand): Promise<void> {
    const userId = UserId.create(command.userId)
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundException(command.userId)
    }
    await this.userRepository.setPassword(userId, command.newPassword)
  }
}
