import type { ICommandHandler } from '@nestjs/cqrs'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { Inject } from '@nestjs/common'
import { CommandHandler } from '@nestjs/cqrs'

import { DeleteAccountUseCase } from '~/application/use-cases/user/delete-account.usecase'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'

export class DeleteAccountCommand {
  constructor(
    public readonly userId: string,
    public readonly accountId: string
  ) {}
}

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler implements ICommandHandler<DeleteAccountCommand, void> {
  private readonly useCase: DeleteAccountUseCase

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository
  ) {
    this.useCase = new DeleteAccountUseCase(this.userRepository)
  }

  async execute(command: DeleteAccountCommand): Promise<void> {
    await this.useCase.execute({
      userId: command.userId,
      accountId: command.accountId
    })
  }
}
