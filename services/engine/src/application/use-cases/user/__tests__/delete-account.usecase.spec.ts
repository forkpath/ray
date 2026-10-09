import type { IUserRepository } from '~/domain/repositories/user.repository.interface'

import { describe, expect, it, vi } from 'vitest'

import { DeleteAccountUseCase } from '~/application/use-cases/user/delete-account.usecase'
import { User, UserRole } from '~/domain/entities/user.entity'
import {
  AccountNotFoundException,
  LastAccountCannotBeDeletedException,
  UserNotFoundException
} from '~/domain/exceptions/user.exception'

const now = new Date('2026-04-28T00:00:00.000Z')

function createUser(): User {
  return User.fromPersistence({
    id: 'user_1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
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

describe('DeleteAccountUseCase', () => {
  it('throws UserNotFoundException when user does not exist', async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(null),
      countAccounts: vi.fn(),
      deleteAccount: vi.fn()
    } as unknown as IUserRepository
    const useCase = new DeleteAccountUseCase(repository)

    await expect(useCase.execute({ userId: 'missing', accountId: 'account_1' })).rejects.toThrow(UserNotFoundException)
    expect(repository.deleteAccount).not.toHaveBeenCalled()
  })

  it('rejects deleting the last authentication account', async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(createUser()),
      countAccounts: vi.fn().mockResolvedValue(1),
      deleteAccount: vi.fn()
    } as unknown as IUserRepository
    const useCase = new DeleteAccountUseCase(repository)

    await expect(useCase.execute({ userId: 'user_1', accountId: 'account_1' })).rejects.toThrow(
      LastAccountCannotBeDeletedException
    )
    expect(repository.deleteAccount).not.toHaveBeenCalled()
  })

  it('translates only a not-deleted result to AccountNotFoundException', async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue(createUser()),
      countAccounts: vi.fn().mockResolvedValue(2),
      deleteAccount: vi.fn().mockResolvedValue(false)
    } as unknown as IUserRepository
    const useCase = new DeleteAccountUseCase(repository)

    await expect(useCase.execute({ userId: 'user_1', accountId: 'missing' })).rejects.toThrow(AccountNotFoundException)
  })

  it('lets unexpected repository errors bubble up', async () => {
    const repositoryError = new Error('database unavailable')
    const repository = {
      findById: vi.fn().mockResolvedValue(createUser()),
      countAccounts: vi.fn().mockResolvedValue(2),
      deleteAccount: vi.fn().mockRejectedValue(repositoryError)
    } as unknown as IUserRepository
    const useCase = new DeleteAccountUseCase(repository)

    await expect(useCase.execute({ userId: 'user_1', accountId: 'account_1' })).rejects.toBe(repositoryError)
  })
})
