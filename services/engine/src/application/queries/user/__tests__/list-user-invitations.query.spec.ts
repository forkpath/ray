import { Test } from '@nestjs/testing'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USER_REPOSITORY } from '#/domain/repositories/user.repository.interface'

import { ListUserInvitationsHandler, ListUserInvitationsQuery } from '../list-user-invitations.query'

describe('ListUserInvitationsHandler', () => {
  let handler: ListUserInvitationsHandler
  const mockRepo = { findInvitations: vi.fn() }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ListUserInvitationsHandler, { provide: USER_REPOSITORY, useValue: mockRepo }]
    }).compile()

    handler = module.get(ListUserInvitationsHandler)
    vi.clearAllMocks()
  })

  it('should return paginated invitations', async () => {
    const expected = {
      list: [{ id: 'i1', organizationId: 'o1', status: 'pending' }],
      total: 1
    }
    mockRepo.findInvitations.mockResolvedValue(expected)

    const result = await handler.execute(new ListUserInvitationsQuery('u1', { page: 1, perPage: 10 }))

    expect(result).toEqual(expected)
    expect(mockRepo.findInvitations).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'u1' }),
      expect.objectContaining({ page: 1, perPage: 10 })
    )
  })

  it('should return empty results', async () => {
    mockRepo.findInvitations.mockResolvedValue({ list: [], total: 0 })

    const result = await handler.execute(new ListUserInvitationsQuery('u1', { page: 1, perPage: 10 }))

    expect(result.list).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
