import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { UserNotFoundException } from '~/domain/exceptions/user.exception'
import { UserId } from '~/domain/value-objects/user-id.vo'

export interface DeleteUserInput {
  readonly userId: string
  readonly operatorId: string
}

export class DeleteUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: DeleteUserInput): Promise<void> {
    const userId = UserId.create(input.userId)
    const operatorId = UserId.create(input.operatorId)
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundException(input.userId)
    }
    user.assertCanBeDeletedBy(operatorId)
    await this.userRepository.delete(userId)
  }
}
