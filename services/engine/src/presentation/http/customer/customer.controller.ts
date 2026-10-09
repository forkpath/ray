import type { GetCustomersRes } from '@libs/payload'

import { Controller, Get, Query } from '@nestjs/common'
import { QueryBus } from '@nestjs/cqrs'

import { Roles } from '@libs/auth-server/nest'

import { ListCustomersQueryDto } from '~/application/dtos/customer/customer.dto'
import { ListCustomersQuery } from '~/application/queries/customer/list-customers.query'

@Controller('admin/customers')
@Roles(['admin'])
export class CustomerController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async list(@Query() query: ListCustomersQueryDto): Promise<GetCustomersRes> {
    return this.queryBus.execute(new ListCustomersQuery(query))
  }
}
