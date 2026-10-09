import type { ICommandHandler } from '@nestjs/cqrs'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { DeleteUserUseCase } from '~/application/use-cases/user/delete-user.usecase'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'

/**
 * 删除用户命令
 */
export class DeleteUserCommand {
  constructor(
    public readonly id: string,
    public readonly operatorId: string
  ) {}
}

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand, void> {
  private readonly useCase: DeleteUserUseCase

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {
    this.useCase = new DeleteUserUseCase(this.userRepository)
  }

  async execute(command: DeleteUserCommand): Promise<void> {
    await this.useCase.execute({ userId: command.id, operatorId: command.operatorId })
  }
}
