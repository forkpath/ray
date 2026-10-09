import type { GetCustomersReq, GetCustomersRes } from '@libs/payload'
import type { BillingCustomerEntity } from '~/domain/entities/customer.entity'
import type {
  DateRangeCriteria,
  ListCustomersCriteria,
  NumberRangeCriteria,
  PagedCustomerResult,
  SortCriteria
} from '~/domain/repositories/customer.repository.interface'

type CustomerListItem = GetCustomersRes['list'][number]

export class CustomerMapper {
  private static toDateRange(range?: [string | number | Date, string | number | Date]): DateRangeCriteria | undefined {
    if (!range) {
      return undefined
    }
    return { from: new Date(range[0]), to: new Date(range[1]) }
  }

  private static toNumberRange(range?: [number, number]): NumberRangeCriteria | undefined {
    if (!range) {
      return undefined
    }
    return { from: range[0], to: range[1] }
  }

  private static toSort(sort?: GetCustomersReq['sort']): SortCriteria[] | undefined {
    return sort?.map(item => ({ field: item.id, desc: item.desc }))
  }

  static toListCustomersCriteria(params: GetCustomersReq): ListCustomersCriteria {
    return {
      page: Number(params.page ?? 1),
      perPage: Number(params.perPage ?? 10),
      sort: this.toSort(params.sort),
      q: params.q,
      provider: params.provider,
      subscriptions: this.toNumberRange(params.subscriptions),
      orders: this.toNumberRange(params.orders),
      createdAt: this.toDateRange(params.createdAt)
    }
  }

  static toCustomerListItem(entity: BillingCustomerEntity): CustomerListItem {
    return {
      id: entity.id.toString(),
      referenceId: entity.referenceId.toString(),
      provider: entity.provider,
      externalId: entity.externalId.toString(),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      user: {
        name: entity.user.name,
        image: entity.user.image
      },
      subscriptions: entity.subscriptionsCount,
      orders: entity.ordersCount
    }
  }

  static toCustomersResponse(result: PagedCustomerResult): GetCustomersRes {
    return {
      list: result.list.map(entity => this.toCustomerListItem(entity)),
      total: result.total,
      max: result.max,
      options: result.options
    }
  }
}
