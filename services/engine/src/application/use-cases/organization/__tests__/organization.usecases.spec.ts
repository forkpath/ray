import type { IOrganizationRepository } from '~/domain/repositories/organization.repository.interface'
import type { MemberRoleValue } from '~/domain/value-objects/member-role.vo'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { RemoveMemberUseCase } from '~/application/use-cases/organization/remove-member.usecase'
import { UpdateOrganizationUseCase } from '~/application/use-cases/organization/update-organization.usecase'
import { Member, Organization } from '~/domain/entities/organization.entity'
import {
  CannotRemoveOwnerException,
  OrganizationSlugConflictException
} from '~/domain/exceptions/organization.exception'
import { MemberRoleEnum } from '~/domain/value-objects/member-role.vo'

const now = new Date('2026-04-28T00:00:00.000Z')

function org(id = 'o1') {
  return Organization.fromPersistence({
    id,
    name: 'Acme',
    slug: 'acme',
    logo: null,
    createdAt: now,
    membersCount: 2
  })
}

function member(role: MemberRoleValue = MemberRoleEnum.MEMBER) {
  return Member.fromPersistence({
    id: 'm1',
    userId: 'u1',
    organizationId: 'o1',
    role,
    createdAt: now,
    user: {
      id: 'u1',
      name: 'Member',
      email: 'm@example.com',
      image: null
    }
  })
}

describe('UpdateOrganizationUseCase', () => {
  let mockRepo: {
    findById: ReturnType<typeof vi.fn>
    findBySlug: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      update: vi.fn()
    }
  })

  it('uses OrganizationSlug value object when checking slug conflicts', async () => {
    const useCase = new UpdateOrganizationUseCase(mockRepo as unknown as IOrganizationRepository)
    const updated = org()
    mockRepo.findById.mockResolvedValue(org())
    mockRepo.findBySlug.mockResolvedValue(null)
    mockRepo.update.mockResolvedValue(updated)

    await useCase.execute({ organizationId: 'o1', slug: 'new-slug' })

    expect(mockRepo.findBySlug).toHaveBeenCalledWith(expect.objectContaining({}))
    expect(mockRepo.findBySlug.mock.calls[0][0].toString()).toBe('new-slug')
    expect(mockRepo.update.mock.calls[0][0].toString()).toBe('o1')
    expect(mockRepo.update.mock.calls[0][1].slug.toString()).toBe('new-slug')
  })

  it('throws when slug belongs to another organization', async () => {
    const useCase = new UpdateOrganizationUseCase(mockRepo as unknown as IOrganizationRepository)
    mockRepo.findById.mockResolvedValue(org('o1'))
    mockRepo.findBySlug.mockResolvedValue(org('o2'))

    await expect(useCase.execute({ organizationId: 'o1', slug: 'new-slug' })).rejects.toThrow(
      OrganizationSlugConflictException
    )
  })
})

describe('RemoveMemberUseCase', () => {
  it('delegates owner removal rule to the Member entity', async () => {
    const mockRepo = {
      findById: vi.fn().mockResolvedValue(org()),
      findMemberById: vi.fn().mockResolvedValue(member(MemberRoleEnum.OWNER)),
      countMembers: vi.fn(),
      deleteMember: vi.fn()
    }
    const useCase = new RemoveMemberUseCase(mockRepo as unknown as IOrganizationRepository)

    await expect(useCase.execute({ organizationId: 'o1', memberId: 'm1' })).rejects.toThrow(CannotRemoveOwnerException)

    expect(mockRepo.deleteMember).not.toHaveBeenCalled()
  })
})
