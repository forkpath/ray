import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { describe, expect, it, vi } from 'vitest'

import { BanUserUseCase } from '~/application/use-cases/user/ban-user.usecase'
import { User, UserRole } from '~/domain/entities/user.entity'
import { CannotOperateSelfException, UserNotFoundException } from '~/domain/exceptions/user.exception'

const now = new Date('2026-04-28T00:00:00.000Z')

function createUser(id = 'user_1'): User {
  return User.fromPersistence({
    id,
    name: 'Ada Lovelace',
    email: `${id}@example.com`,
    emailVerified: true,
    image: null,
    twoFactorEnabled: false,
    isAnonymous: false,
    role: UserRole.USER,
    banned: false,
    banReason: null,
    banExpires: null,
    createdAt: now,
    updatedAt: now
  })
}

describe('BanUserUseCase', () => {
  it('uses the user entity rule before delegating ban persistence', async () => {
    const user = createUser()
    const bannedUser = createUser()
    const repository = {
      findById: vi.fn().mockResolvedValue(user),
      ban: vi.fn().mockResolvedValue(bannedUser)
    } as unknown as IUserRepository
    const useCase = new BanUserUseCase(repository)

    const result = await useCase.execute({
      userId: 'user_1',
      operatorId: 'operator_1',
      reason: 'spam'
    })

    expect(repository.findById).toHaveBeenCalledWith(expect.objectContaining({}))
    expect(repository.ban).toHaveBeenCalledWith(expect.objectContaining({}), 'spam', undefined)
    expect(result.user).toBe(bannedUser)
  })

  it('throws domain not found exception when user does not exist', async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(null),
      ban: vi.fn()
    } as unknown as IUserRepository
    const useCase = new BanUserUseCase(repository)

    await expect(useCase.execute({ userId: 'missing', operatorId: 'operator_1' })).rejects.toThrow(
      UserNotFoundException
    )
    expect(repository.ban).not.toHaveBeenCalled()
  })

  it('throws entity domain exception when operator bans self', async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(createUser('user_1')),
      ban: vi.fn()
    } as unknown as IUserRepository
    const useCase = new BanUserUseCase(repository)

    await expect(useCase.execute({ userId: 'user_1', operatorId: 'user_1' })).rejects.toThrow(
      CannotOperateSelfException
    )
    expect(repository.ban).not.toHaveBeenCalled()
  })
})
