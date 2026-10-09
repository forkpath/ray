import type { BillingCustomerEntity } from '~/domain/entities/customer.entity'

export interface DateRangeCriteria {
  readonly from: Date
  readonly to: Date
}

export interface NumberRangeCriteria {
  readonly from: number
  readonly to: number
}

export interface SortCriteria {
  readonly field: string
  readonly desc: boolean
}

export interface ListCustomersCriteria {
  readonly page: number
  readonly perPage: number
  readonly sort?: SortCriteria[]
  readonly q?: string
  readonly provider?: string[]
  readonly subscriptions?: NumberRangeCriteria
  readonly orders?: NumberRangeCriteria
  readonly createdAt?: DateRangeCriteria
}

export interface PagedCustomerResult {
  readonly list: BillingCustomerEntity[]
  readonly total: number
  readonly max: { subscriptions: number; orders: number }
  readonly options: { provider: string[] }
}

export interface ICustomerRepository {
  findAll(params: ListCustomersCriteria): Promise<PagedCustomerResult>

  count(): Promise<number>
}

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY')
