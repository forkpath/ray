import { Test } from '@nestjs/testing'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USER_REPOSITORY } from '#/domain/repositories/user.repository.interface'

import { ListUserSubscriptionsHandler, ListUserSubscriptionsQuery } from '../list-user-subscriptions.query'

describe('ListUserSubscriptionsHandler', () => {
  let handler: ListUserSubscriptionsHandler
  const mockRepo = { findSubscriptions: vi.fn() }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ListUserSubscriptionsHandler, { provide: USER_REPOSITORY, useValue: mockRepo }]
    }).compile()

    handler = module.get(ListUserSubscriptionsHandler)
    vi.clearAllMocks()
  })

  it('should return paginated subscriptions', async () => {
    const expected = { list: [{ id: 's1', status: 'active' }], total: 1 }
    mockRepo.findSubscriptions.mockResolvedValue(expected)

    const result = await handler.execute(new ListUserSubscriptionsQuery('u1', { page: 1, perPage: 10 }))

    expect(result).toEqual(expected)
    expect(mockRepo.findSubscriptions).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'u1' }),
      expect.objectContaining({ page: 1, perPage: 10 })
    )
  })

  it('should return empty results', async () => {
    mockRepo.findSubscriptions.mockResolvedValue({ list: [], total: 0 })

    const result = await handler.execute(new ListUserSubscriptionsQuery('u1', { page: 1, perPage: 10 }))

    expect(result.list).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
