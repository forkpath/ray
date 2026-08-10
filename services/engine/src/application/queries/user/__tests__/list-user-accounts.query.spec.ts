import { Test } from '@nestjs/testing'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USER_REPOSITORY } from '#/domain/repositories/user.repository.interface'

import { ListUserAccountsHandler, ListUserAccountsQuery } from '../list-user-accounts.query'

describe('ListUserAccountsHandler', () => {
  let handler: ListUserAccountsHandler
  const mockRepo = { findAccounts: vi.fn() }

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ListUserAccountsHandler, { provide: USER_REPOSITORY, useValue: mockRepo }]
    }).compile()

    handler = module.get(ListUserAccountsHandler)
    vi.clearAllMocks()
  })

  it('should return paginated accounts', async () => {
    const expected = { list: [{ id: 'a1', providerId: 'google' }], total: 1 }
    mockRepo.findAccounts.mockResolvedValue(expected)

    const result = await handler.execute(new ListUserAccountsQuery('u1', { page: 1, perPage: 10 }))

    expect(result).toEqual(expected)
    expect(mockRepo.findAccounts).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'u1' }),
      expect.objectContaining({ page: 1, perPage: 10 })
    )
  })

  it('should return empty results', async () => {
    mockRepo.findAccounts.mockResolvedValue({ list: [], total: 0 })

    const result = await handler.execute(new ListUserAccountsQuery('u1', { page: 1, perPage: 10 }))

    expect(result.list).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
