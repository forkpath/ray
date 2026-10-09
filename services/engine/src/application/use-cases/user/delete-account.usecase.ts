import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import {
  AccountNotFoundException,
  LastAccountCannotBeDeletedException,
  UserNotFoundException
} from '~/domain/exceptions/user.exception'
import { UserId } from '~/domain/value-objects/user-id.vo'

export interface DeleteAccountInput {
  readonly userId: string
  readonly accountId: string
}

export class DeleteAccountUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: DeleteAccountInput): Promise<void> {
    const userId = UserId.create(input.userId)
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundException(input.userId)
    }
    const accountCount = await this.userRepository.countAccounts(userId)
    if (accountCount <= 1) {
      throw new LastAccountCannotBeDeletedException(input.userId)
    }
    const deleted = await this.userRepository.deleteAccount(userId, input.accountId)
    if (!deleted) {
      throw new AccountNotFoundException(input.accountId)
    }
  }
}
