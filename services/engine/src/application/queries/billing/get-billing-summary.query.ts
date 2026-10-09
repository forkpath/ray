import type { IQueryHandler } from '@nestjs/cqrs'
import type { IBillingRepository } from '~/domain/repositories/billing.repository.interface'
import type { BillingOwner } from '~/domain/value-objects/billing-owner.vo'

import { Inject } from '@nestjs/common'
import { QueryHandler } from '@nestjs/cqrs'

import { GetBillingSummaryUseCase } from '~/application/use-cases/billing/get-billing-summary.use-case'
import { BILLING_REPOSITORY } from '~/domain/repositories/billing.repository.interface'

export class GetBillingSummaryQuery {
  constructor(
    public readonly actorUserId: string,
    public readonly owner: BillingOwner
  ) {}
}

@QueryHandler(GetBillingSummaryQuery)
export class GetBillingSummaryHandler implements IQueryHandler<GetBillingSummaryQuery> {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly repository: IBillingRepository
  ) {}

  execute(query: GetBillingSummaryQuery) {
    return new GetBillingSummaryUseCase(this.repository).execute(query)
  }
}
