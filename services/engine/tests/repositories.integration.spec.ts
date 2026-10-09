import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prisma } from '@libs/pg-dao'
import { createIdentity, createOrganization } from '@libs/testing-server'

import { OrganizationId } from '~/domain/value-objects/organization-id.vo'
import { UserId } from '~/domain/value-objects/user-id.vo'
import { CustomerRepository } from '~/infrastructure/repositories/customer.repository'
import { OrganizationRepository } from '~/infrastructure/repositories/organization.repository'

describe('real admin list repositories', () => {
  const customers = new CustomerRepository()
  const organizations = new OrganizationRepository()
  const marker = randomUUID()
  let personalCustomerId: string
  let organizationCustomerId: string

  beforeAll(async () => {
    const user = await createIdentity()
    await prisma.user.update({ where: { id: user.id }, data: { name: `A-${marker}` } })
    const organization = await createOrganization(user.id)
    await prisma.organization.update({ where: { id: organization.id }, data: { name: `B-${marker}` } })
    personalCustomerId = (
      await prisma.customer.create({
        data: { userId: user.id, externalId: `cus_${marker}_user`, provider: 'stripe' }
      })
    ).id
    organizationCustomerId = (
      await prisma.customer.create({
        data: { organizationId: organization.id, externalId: `cus_${marker}_org`, provider: 'stripe' }
      })
    ).id
    await prisma.order.createMany({
      data: [1, 2].map(index => ({
        customerId: personalCustomerId,
        externalId: `${marker}_order_${index}`,
        variantId: 'test',
        status: 'succeeded',
        store: 'stripe'
      }))
    })
    await prisma.subscription.createMany({
      data: [1, 2].map(index => ({
        customerId: personalCustomerId,
        externalId: `${marker}_subscription_${index}`,
        variantId: 'test',
        status: 'active',
        store: 'stripe',
        periodStartsAt: new Date(),
        periodEndsAt: new Date(Date.now() + 86_400_000)
      }))
    })
  })

  afterAll(() => prisma.$disconnect())

  it('lists both owner kinds using the real schema and the UI default sort', async () => {
    const result = await customers.findAll({
      page: 1,
      perPage: 10,
      q: marker,
      sort: [{ field: 'user.name', desc: false }]
    })
    expect(result.total).toBe(2)
    expect(result.list.map(customer => customer.id.toString())).toEqual([personalCustomerId, organizationCustomerId])
    expect(result.list.map(customer => customer.user.name)).toEqual([`A-${marker}`, `B-${marker}`])
    expect(result.list[0]).toMatchObject({ subscriptionsCount: 2, ordersCount: 2 })
    expect(result.list[1]).toMatchObject({ subscriptionsCount: 0, ordersCount: 0 })
  })

  it('filters aggregate counts without multiplying joins and preserves the total on an empty page', async () => {
    const filters = { page: 1, perPage: 1, q: marker, subscriptions: { from: 2, to: 2 } }
    expect((await customers.findAll(filters)).list.map(customer => customer.id.toString())).toEqual([
      personalCustomerId
    ])
    expect(await customers.findAll({ ...filters, page: 3 })).toMatchObject({ list: [], total: 1 })
    expect(await customers.findAll({ page: 1, perPage: 10, q: "' OR 1=1 --" })).toMatchObject({ list: [], total: 0 })
    expect(await customers.findAll({ page: 1, perPage: 10, provider: ["stripe') OR 1=1 --"] })).toMatchObject({
      list: [],
      total: 0
    })
  })

  it('sorts and filters organizations while preserving empty-page totals', async () => {
    const filters = {
      page: 1,
      perPage: 1,
      q: marker,
      members: { from: 1, to: 1 },
      sort: [{ field: 'members', desc: true }]
    }
    expect(await organizations.findAll(filters)).toMatchObject({ total: 1 })
    expect(await organizations.findAll({ ...filters, page: 3 })).toMatchObject({ list: [], total: 1 })
    expect(await organizations.findAll({ page: 1, perPage: 10, q: "' OR 1=1 --" })).toMatchObject({
      list: [],
      total: 0
    })
  })

  it.each([
    { name: 'customers', repository: customers },
    { name: 'organizations', repository: organizations }
  ])('rejects SQL expressions in $name even when a caller bypasses the HTTP schema', async ({ repository }) => {
    for (const field of ['createdAt, (select 1)', '__proto__', 'constructor', 'unknown']) {
      await expect(repository.findAll({ page: 1, perPage: 10, sort: [{ field, desc: false }] })).rejects.toThrow(
        /sort/i
      )
    }
  })
})

describe('real organization membership lookups', () => {
  const organizations = new OrganizationRepository()

  afterAll(() => prisma.$disconnect())

  it('resolves membership roles and counts owners within one organization', async () => {
    const owner = await createIdentity()
    const admin = await createIdentity()
    const outsider = await createIdentity()
    const organization = await createOrganization(owner.id)
    const otherOrganization = await createOrganization(outsider.id)
    await prisma.member.create({
      data: {
        id: randomUUID(),
        organizationId: organization.id,
        userId: admin.id,
        role: 'admin',
        createdAt: new Date()
      }
    })
    const orgId = OrganizationId.create(organization.id)

    expect(await organizations.findMemberRole(orgId, UserId.create(owner.id))).toBe('owner')
    expect(await organizations.findMemberRole(orgId, UserId.create(admin.id))).toBe('admin')
    expect(await organizations.findMemberRole(orgId, UserId.create(outsider.id))).toBeNull()
    expect(await organizations.countMembersByRole(orgId, 'owner')).toBe(1)
    expect(await organizations.countMembersByRole(orgId, 'admin')).toBe(1)
    expect(await organizations.countMembersByRole(OrganizationId.create(otherOrganization.id), 'admin')).toBe(0)
  })
})
