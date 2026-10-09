import { describe, expect, it } from 'vitest'

import { User, UserRole } from '~/domain/entities/user.entity'
import { CannotOperateSelfException, UserAlreadyBannedException } from '~/domain/exceptions/user.exception'
import { Email } from '~/domain/value-objects/email.vo'
import { UserId } from '~/domain/value-objects/user-id.vo'

const now = new Date('2026-04-28T00:00:00.000Z')

function createUser(overrides: Partial<Parameters<typeof User.fromPersistence>[0]> = {}): User {
  return User.fromPersistence({
    id: 'user_1',
    name: 'Ada Lovelace',
    email: 'Ada@Example.COM',
    emailVerified: true,
    image: null,
    twoFactorEnabled: false,
    isAnonymous: false,
    role: UserRole.USER,
    banned: false,
    banReason: null,
    banExpires: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  })
}

describe('User', () => {
  it('reconstitutes a better-auth user with validated value objects', () => {
    const actualUser = createUser()

    expect(actualUser.id).toBeInstanceOf(UserId)
    expect(actualUser.email).toBeInstanceOf(Email)
    expect(actualUser.email.toString()).toBe('ada@example.com')
    expect(actualUser.name).toBe('Ada Lovelace')
  })

  it('rejects banning the acting user', () => {
    const actualUser = createUser()

    expect(() => actualUser.assertCanBeBannedBy(UserId.create('user_1'))).toThrow(CannotOperateSelfException)
  })

  it('rejects banning an already banned user', () => {
    const actualUser = createUser({ banned: true })

    expect(() => actualUser.assertCanBeBannedBy(UserId.create('operator_1'))).toThrow(UserAlreadyBannedException)
  })

  it('updates profile through entity behaviour', () => {
    const actualUser = createUser()

    actualUser.changeProfile({ name: 'Grace Hopper', image: 'https://example.com/avatar.png' })

    expect(actualUser.name).toBe('Grace Hopper')
    expect(actualUser.image).toBe('https://example.com/avatar.png')
  })
})
