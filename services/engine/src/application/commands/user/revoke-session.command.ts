import type { ICommandHandler } from '@nestjs/cqrs'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

/**
 * 撤销单个会话命令
 */
export class RevokeSessionCommand {
  constructor(public readonly token: string) {}
}

@CommandHandler(RevokeSessionCommand)
export class RevokeSessionHandler implements ICommandHandler<RevokeSessionCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(command: RevokeSessionCommand): Promise<void> {
    await this.userRepository.revokeSession(command.token)
  }
}

/**
 * 撤销用户所有会话命令
 */
export class RevokeAllSessionsCommand {
  constructor(public readonly userId: string) {}
}

@CommandHandler(RevokeAllSessionsCommand)
export class RevokeAllSessionsHandler implements ICommandHandler<RevokeAllSessionsCommand, void> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {}

  async execute(command: RevokeAllSessionsCommand): Promise<void> {
    await this.userRepository.revokeAllSessions(UserId.create(command.userId))
  }
}
