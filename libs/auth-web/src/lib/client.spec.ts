import type { ActiveOrganization, Session, User } from './client'

import { describe, expect, it } from 'vitest'

import { resolvePermissionCheckSuccess } from './permission-result'

type Assert<T extends true> = T
type SessionHasActiveOrganization = Assert<'activeOrganizationId' extends keyof Session['session'] ? true : false>
type UserHasAdminRole = Assert<'role' extends keyof User ? true : false>
type UserHasAnonymousState = Assert<'isAnonymous' extends keyof User ? true : false>
type UserHasTwoFactorState = Assert<'twoFactorEnabled' extends keyof User ? true : false>
type OrganizationHasMembers = Assert<'members' extends keyof ActiveOrganization ? true : false>

const inferenceContract: [
  SessionHasActiveOrganization,
  UserHasAdminRole,
  UserHasAnonymousState,
  UserHasTwoFactorState,
  OrganizationHasMembers
] = [true, true, true, true, true]

describe('auth web client contract', () => {
  it('preserves plugin-provided model inference without importing the server', () => {
    expect(inferenceContract).toEqual([true, true, true, true, true])
  })

  it.each([
    [true, true],
    [false, false],
    [{ success: true }, true],
    [{ data: { success: true } }, true],
    [{ success: 'true' }, false],
    [{ data: {} }, false],
    [null, false]
  ])('normalizes permission result %# fail-closed', (value, expected) => {
    expect(resolvePermissionCheckSuccess(value)).toBe(expected)
  })
})
