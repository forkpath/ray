import type { User } from '~/domain/entities/user.entity'
import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { UserNotFoundException } from '~/domain/exceptions/user.exception'
import { UserId } from '~/domain/value-objects/user-id.vo'

export interface BanUserInput {
  readonly userId: string
  readonly operatorId: string
  readonly reason?: string
  readonly expiresAt?: Date
}

export interface BanUserOutput {
  readonly user: User
}

export class BanUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: BanUserInput): Promise<BanUserOutput> {
    const userId = UserId.create(input.userId)
    const operatorId = UserId.create(input.operatorId)
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundException(input.userId)
    }
    user.assertCanBeBannedBy(operatorId)
    const bannedUser = await this.userRepository.ban(userId, input.reason, input.expiresAt)
    return { user: bannedUser }
  }
}
