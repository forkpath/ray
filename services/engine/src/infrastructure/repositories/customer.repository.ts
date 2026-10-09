import type { BillingCustomerEntity } from '~/domain/entities/customer.entity'
import type {
  ICustomerRepository,
  ListCustomersCriteria,
  PagedCustomerResult
} from '~/domain/repositories/customer.repository.interface'

import { Injectable } from '@nestjs/common'

import { Prisma, prisma } from '@libs/pg-dao'

import { BillingCustomer } from '~/domain/entities/customer.entity'

import { listOffset, listOrder } from './list-query'

@Injectable()
export class CustomerRepository implements ICustomerRepository {
  async findAll(params: ListCustomersCriteria): Promise<PagedCustomerResult> {
    const { page, perPage, sort, q, provider, subscriptions, orders, createdAt } = params

    const offset = listOffset(page, perPage)
    const orderBy = listOrder(
      sort,
      new Map([
        ['id', Prisma.sql`c.id`],
        ['referenceId', Prisma.sql`COALESCE(c.user_id, c.organization_id)`],
        ['externalId', Prisma.sql`c.external_id`],
        ['provider', Prisma.sql`c.provider`],
        ['createdAt', Prisma.sql`c.created_at`],
        ['updatedAt', Prisma.sql`c.updated_at`],
        ['user.name', Prisma.sql`COALESCE(u.name, o.name)`],
        ['subscriptions', Prisma.sql`COUNT(DISTINCT s.id)`],
        ['orders', Prisma.sql`COUNT(DISTINCT ord.id)`]
      ]),
      Prisma.sql`c.created_at ASC`,
      Prisma.sql`c.id ASC`
    )
    const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`]
    if (q)
      conditions.push(
        Prisma.sql`(u.name ILIKE ${`%${q}%`} OR o.name ILIKE ${`%${q}%`} OR c.external_id ILIKE ${`%${q}%`})`
      )
    if (provider?.length) conditions.push(Prisma.sql`c.provider IN (${Prisma.join(provider)})`)
    if (createdAt) conditions.push(Prisma.sql`c.created_at BETWEEN ${createdAt.from} AND ${createdAt.to}`)
    const having: Prisma.Sql[] = [Prisma.sql`TRUE`]
    if (subscriptions)
      having.push(Prisma.sql`COUNT(DISTINCT s.id) BETWEEN ${subscriptions.from} AND ${subscriptions.to}`)
    if (orders) having.push(Prisma.sql`COUNT(DISTINCT ord.id) BETWEEN ${orders.from} AND ${orders.to}`)
    const grouped = Prisma.sql`
      FROM billing.customer c
      LEFT JOIN public."user" u ON c.user_id = u.id
      LEFT JOIN public.organization o ON c.organization_id = o.id
      LEFT JOIN billing.subscription s ON s.customer_id = c.id
      LEFT JOIN billing."order" ord ON ord.customer_id = c.id
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY c.id, u.name, u.image, o.name, o.logo
      HAVING ${Prisma.join(having, ' AND ')}
    `
    const rows = await prisma.$queryRaw<
      Array<{
        id: string
        reference_id: string
        provider: string
        external_id: string
        created_at: Date
        updated_at: Date
        user_name: string
        user_image: string | null
        sub_count: number
        ord_count: number
        total_count: number
      }>
    >(Prisma.sql`
      SELECT c.id, COALESCE(c.user_id, c.organization_id) AS reference_id,
        c.provider, c.external_id, c.created_at, c.updated_at,
        COALESCE(u.name, o.name) AS user_name, COALESCE(u.image, o.logo) AS user_image,
        COUNT(DISTINCT s.id)::int AS sub_count, COUNT(DISTINCT ord.id)::int AS ord_count,
        COUNT(*) OVER()::int AS total_count
      ${grouped}
      ORDER BY ${orderBy}
      LIMIT ${perPage} OFFSET ${offset}
    `)
    // A window count has no row to carry it when an offset is past the last page.
    const total =
      rows[0]?.total_count ??
      (offset > 0
        ? ((
            await prisma.$queryRaw<Array<{ total: number }>>(
              Prisma.sql`SELECT COUNT(*)::int AS total FROM (SELECT c.id ${grouped}) filtered`
            )
          )[0]?.total ?? 0)
        : 0)
    const maxResult = await prisma.$queryRaw<Array<{ max_subscriptions: number; max_orders: number }>>(Prisma.sql`
      SELECT COALESCE(MAX(sub_count), 0)::int AS max_subscriptions,
        COALESCE(MAX(ord_count), 0)::int AS max_orders
      FROM (
        SELECT COUNT(DISTINCT s.id) AS sub_count, COUNT(DISTINCT ord.id) AS ord_count
        FROM billing.customer c
        LEFT JOIN billing.subscription s ON s.customer_id = c.id
        LEFT JOIN billing."order" ord ON ord.customer_id = c.id
        GROUP BY c.id
      ) counts
    `)
    const providerRows = await prisma.$queryRaw<Array<{ provider: string }>>(Prisma.sql`
      SELECT DISTINCT provider FROM billing.customer ORDER BY provider
    `)

    return {
      list: rows.map(r =>
        this.mapToEntity({
          id: r.id,
          referenceId: r.reference_id,
          provider: r.provider,
          externalId: r.external_id,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          user: {
            name: r.user_name,
            image: r.user_image
          },
          subscriptionsCount: r.sub_count,
          ordersCount: r.ord_count
        })
      ),
      total,
      max: {
        subscriptions: maxResult[0]?.max_subscriptions ?? 0,
        orders: maxResult[0]?.max_orders ?? 0
      },
      options: {
        provider: providerRows.map(r => r.provider)
      }
    }
  }

  async count(): Promise<number> {
    return prisma.customer.count()
  }

  private mapToEntity(data: {
    id: string
    referenceId: string
    provider: string
    externalId: string
    createdAt: Date
    updatedAt: Date
    user: {
      name: string
      image: string | null
    }
    subscriptionsCount: number
    ordersCount: number
  }): BillingCustomerEntity {
    return BillingCustomer.fromPersistence(data)
  }
}
