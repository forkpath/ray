import { Test } from '@nestjs/testing'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ListUserOrdersHandler, ListUserOrdersQuery } from '~/application/queries/user/list-user-orders.query'
import { USER_REPOSITORY } from '~/domain/repositories/user.repository.interface'
import { UserId } from '~/domain/value-objects/user-id.vo'

describe('ListUserOrdersHandler', () => {
  let handler: ListUserOrdersHandler
  const mockRepo = { findOrders: vi.fn() }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ListUserOrdersHandler, { provide: USER_REPOSITORY, useValue: mockRepo }]
    }).compile()

    handler = module.get(ListUserOrdersHandler)
    vi.clearAllMocks()
  })

  it('should return paginated orders', async () => {
    const expected = { list: [{ id: 'o1', status: 'paid' }], total: 1 }
    mockRepo.findOrders.mockResolvedValue(expected)

    const result = await handler.execute(new ListUserOrdersQuery('u1', { page: 1, perPage: 10 }))

    expect(result).toEqual(expected)
    expect(mockRepo.findOrders).toHaveBeenCalledWith(
      expect.any(UserId),
      expect.objectContaining({ page: 1, perPage: 10 })
    )
  })

  it('should return empty results', async () => {
    mockRepo.findOrders.mockResolvedValue({ list: [], total: 0 })

    const result = await handler.execute(new ListUserOrdersQuery('u1', { page: 1, perPage: 10 }))

    expect(result.list).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
