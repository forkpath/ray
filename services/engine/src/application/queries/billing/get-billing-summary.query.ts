import type { IQueryHandler } from '@nestjs/cqrs'
import type { BillingOwner } from '@libs/billing-contract'

import { QueryHandler } from '@nestjs/cqrs'

import { BillingService } from '../../services/billing.service'

export class GetBillingSummaryQuery {
  constructor(public readonly owner: BillingOwner) {}
}

@QueryHandler(GetBillingSummaryQuery)
export class GetBillingSummaryHandler implements IQueryHandler<GetBillingSummaryQuery> {
  constructor(private readonly billingService: BillingService) {}

  execute(query: GetBillingSummaryQuery) {
    return this.billingService.getSummary(query.owner)
  }
}
