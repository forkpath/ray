import { describe, expect, it } from 'vitest'

import { BillingCustomer } from '~/domain/entities/customer.entity'
import { CustomerId } from '~/domain/value-objects/customer-id.vo'
import { ExternalId } from '~/domain/value-objects/external-id.vo'

const now = new Date('2026-04-28T00:00:00.000Z')

describe('BillingCustomer', () => {
  it('reconstitutes with CustomerId and ExternalId value objects', () => {
    const customer = BillingCustomer.fromPersistence({
      id: 'customer_1',
      referenceId: 'user_1',
      provider: 'stripe',
      externalId: 'cus_123',
      createdAt: now,
      updatedAt: now,
      user: {
        name: 'Ada',
        image: null
      },
      subscriptionsCount: 2,
      ordersCount: 1
    })

    expect(customer.id).toBeInstanceOf(CustomerId)
    expect(customer.externalId).toBeInstanceOf(ExternalId)
    expect(customer.externalId.toString()).toBe('cus_123')
    expect(customer.provider).toBe('stripe')
  })

  it('keeps provider-specific external id validation in the entity boundary', () => {
    expect(() =>
      BillingCustomer.fromPersistence({
        id: 'customer_1',
        referenceId: 'user_1',
        provider: 'stripe',
        externalId: 'not_a_stripe_customer',
        createdAt: now,
        updatedAt: now,
        user: {
          name: 'Ada',
          image: null
        },
        subscriptionsCount: 0,
        ordersCount: 0
      })
    ).toThrow('External ID for stripe must start with "cus_"')
  })
})
