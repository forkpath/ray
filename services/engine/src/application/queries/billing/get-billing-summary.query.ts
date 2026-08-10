import type { IQueryHandler } from '@nestjs/cqrs'
import type { BillingOwner } from '@libs/billing-contract'

import { QueryHandler } from '@nestjs/cqrs'

import { BillingService } from '../../services/billing.service'
import { UserOrganizationAccessService } from '../../services/user-organization-access.service'

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

export class GetOrganizationBillingSummaryQuery {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string
  ) {}
}

@QueryHandler(GetOrganizationBillingSummaryQuery)
export class GetOrganizationBillingSummaryHandler implements IQueryHandler<GetOrganizationBillingSummaryQuery> {
  constructor(
    private readonly billingService: BillingService,
    private readonly accessService: UserOrganizationAccessService
  ) {}

  async execute(query: GetOrganizationBillingSummaryQuery) {
    this.billingService.assertOrganizationBillingEnabled()
    await this.accessService.ensureMember(query.organizationId, query.userId)

    return this.billingService.getSummary({ kind: 'organization', organizationId: query.organizationId })
  }
}
