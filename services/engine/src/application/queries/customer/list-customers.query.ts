import type { IQueryHandler } from '@nestjs/cqrs'
import type { GetCustomersReq, GetCustomersRes } from '@libs/payload'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { CustomerMapper } from '~/application/mappers/customer.mapper'
import { ListCustomersUseCase } from '~/application/use-cases/customer/list-customers.usecase'

export class ListCustomersQuery {
  constructor(public readonly params: GetCustomersReq) {}
}

@QueryHandler(ListCustomersQuery)
export class ListCustomersHandler implements IQueryHandler<ListCustomersQuery, GetCustomersRes> {
  constructor(@Inject(ListCustomersUseCase) private readonly useCase: ListCustomersUseCase) {}

  async execute(query: ListCustomersQuery): Promise<GetCustomersRes> {
    const result = await this.useCase.execute(CustomerMapper.toListCustomersCriteria(query.params))
    return CustomerMapper.toCustomersResponse(result)
  }
}
