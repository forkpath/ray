import { ForbiddenException } from '@nestjs/common'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UserOrganizationAccessService } from './user-organization-access.service'

const { findFirst, count } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  count: vi.fn()
}))

vi.mock('@libs/pg-dao', () => ({
  prisma: {
    member: {
      findFirst,
      count
    }
  }
}))

describe('user organization access service', () => {
  const service = new UserOrganizationAccessService()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects users who are not members', async () => {
    findFirst.mockResolvedValue(null)

    await expect(service.ensureMember('org-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('allows any member to read organization data', async () => {
    findFirst.mockResolvedValue({ role: 'member' })

    await expect(service.ensureMember('org-1', 'user-1')).resolves.toBe('member')
  })

  it.each(['owner', 'admin'])('allows the %s role to manage billing', async role => {
    findFirst.mockResolvedValue({ role })

    await expect(service.ensureBillingManagementAccess('org-1', 'user-1')).resolves.toBeUndefined()
  })

  it('rejects ordinary members from billing management', async () => {
    findFirst.mockResolvedValue({ role: 'member' })

    await expect(service.ensureBillingManagementAccess('org-1', 'user-1')).rejects.toThrow(
      'Only organization owners and admins can manage billing'
    )
  })
})
