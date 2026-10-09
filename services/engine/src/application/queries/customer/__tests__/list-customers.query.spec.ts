import type { ICustomerRepository } from '~/domain/repositories/customer.repository.interface'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ListCustomersHandler, ListCustomersQuery } from '~/application/queries/customer/list-customers.query'
import { ListCustomersUseCase } from '~/application/use-cases/customer/list-customers.usecase'
import { BillingCustomer } from '~/domain/entities/customer.entity'

vi.mock('~/domain/repositories/customer.repository.interface', () => ({
  CUSTOMER_REPOSITORY: Symbol('CUSTOMER_REPOSITORY')
}))

describe('ListCustomersHandler', () => {
  let handler: ListCustomersHandler
  const mockRepo = { findAll: vi.fn(), count: vi.fn() }

  beforeEach(() => {
    handler = new ListCustomersHandler(new ListCustomersUseCase(mockRepo as unknown as ICustomerRepository))
    vi.clearAllMocks()
  })

  it('should return customers with aggregation data', async () => {
    const repoResult = {
      list: [
        BillingCustomer.fromPersistence({
          id: 'c1',
          referenceId: 'u1',
          provider: 'stripe',
          externalId: 'cus_123',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { name: 'Test', image: null },
          subscriptionsCount: 2,
          ordersCount: 1
        })
      ],
      total: 1,
      max: { subscriptions: 2, orders: 1 },
      options: { provider: ['stripe'] }
    }
    mockRepo.findAll.mockResolvedValue(repoResult)

    const result = await handler.execute(new ListCustomersQuery({ page: 1, perPage: 10 }))

    expect(mockRepo.findAll.mock.calls[0][0]).toEqual({ page: 1, perPage: 10 })
    expect(result.total).toBe(1)
    expect(result.max.subscriptions).toBe(2)
    expect(result.options.provider).toContain('stripe')
    expect(result.list[0].subscriptions).toBe(2)
  })
})
