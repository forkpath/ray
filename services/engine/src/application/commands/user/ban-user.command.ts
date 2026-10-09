import type { ICommandHandler } from '@nestjs/cqrs'
import type { UserResponse } from '~/application/dtos/user/user.dto'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { UserMapper } from '~/application/mappers/user.mapper'
import { BanUserUseCase } from '~/application/use-cases/user/ban-user.usecase'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'

/**
 * 封禁用户命令
 */
export class BanUserCommand {
  constructor(
    public readonly id: string,
    public readonly operatorId: string,
    public readonly reason?: string,
    public readonly expiresAt?: Date
  ) {}
}

@CommandHandler(BanUserCommand)
export class BanUserHandler implements ICommandHandler<BanUserCommand, UserResponse> {
  private readonly useCase: BanUserUseCase

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {
    this.useCase = new BanUserUseCase(this.userRepository)
  }

  async execute(command: BanUserCommand): Promise<UserResponse> {
    const result = await this.useCase.execute({
      userId: command.id,
      operatorId: command.operatorId,
      reason: command.reason,
      expiresAt: command.expiresAt
    })
    return UserMapper.toResponse(result.user)
  }
}
