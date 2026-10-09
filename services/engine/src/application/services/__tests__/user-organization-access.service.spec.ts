import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'
import type { MemberRoleValue } from '~/domain/value-objects/member-role.vo'

import { ForbiddenException } from '@nestjs/common'

import { describe, expect, it, vi } from 'vitest'

import { UserOrganizationAccessService } from '~/application/services/user-organization-access.service'

function service(role: MemberRoleValue | null, ownerCount = 1) {
  const repository = {
    findMemberRole: vi.fn().mockResolvedValue(role),
    countMembersByRole: vi.fn().mockResolvedValue(ownerCount)
  }
  return {
    repository,
    access: new UserOrganizationAccessService(repository as unknown as IOrganizationRepository)
  }
}

describe('UserOrganizationAccessService', () => {
  it('returns the member role and rejects non-members', async () => {
    await expect(service('member').access.ensureMember('o1', 'u1')).resolves.toBe('member')
    await expect(service(null).access.ensureMember('o1', 'u1')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('only allows owners and admins to access invitations', async () => {
    await expect(service('owner').access.ensureInvitationAccess('o1', 'u1')).resolves.toBeUndefined()
    await expect(service('admin').access.ensureInvitationAccess('o1', 'u1')).resolves.toBeUndefined()
    await expect(service('member').access.ensureInvitationAccess('o1', 'u1')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('counts owners only for owners', async () => {
    const member = service('member')
    await expect(member.access.isOnlyOwner('o1', 'u1')).resolves.toEqual({ isOnlyOwner: false })
    expect(member.repository.countMembersByRole).not.toHaveBeenCalled()

    const soleOwner = service('owner', 1)
    await expect(soleOwner.access.isOnlyOwner('o1', 'u1')).resolves.toEqual({ isOnlyOwner: true })
    expect(soleOwner.repository.countMembersByRole.mock.calls[0][1]).toBe('owner')

    await expect(service('owner', 2).access.isOnlyOwner('o1', 'u1')).resolves.toEqual({ isOnlyOwner: false })
  })
})
