import { Test } from '@nestjs/testing'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ListUserMembershipsHandler,
  ListUserMembershipsQuery
} from '~/application/queries/user/list-user-memberships.query'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

describe('ListUserMembershipsHandler', () => {
  let handler: ListUserMembershipsHandler
  const mockRepo = { findMemberships: vi.fn() }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ListUserMembershipsHandler, { provide: USER_REPOSITORY, useValue: mockRepo }]
    }).compile()

    handler = module.get(ListUserMembershipsHandler)
    vi.clearAllMocks()
  })

  it('should return paginated memberships', async () => {
    const expected = {
      list: [{ id: 'm1', organizationId: 'o1', role: 'member' }],
      total: 1
    }
    mockRepo.findMemberships.mockResolvedValue(expected)

    const result = await handler.execute(new ListUserMembershipsQuery('u1', { page: 1, perPage: 10 }))

    expect(result).toEqual(expected)
    expect(mockRepo.findMemberships).toHaveBeenCalledWith(
      expect.any(UserId),
      expect.objectContaining({ page: 1, perPage: 10 })
    )
  })

  it('should return empty results', async () => {
    mockRepo.findMemberships.mockResolvedValue({ list: [], total: 0 })

    const result = await handler.execute(new ListUserMembershipsQuery('u1', { page: 1, perPage: 10 }))

    expect(result.list).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
