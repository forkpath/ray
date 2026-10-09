import type { IBillingRepository } from '~/domain/repositories/billing.repository.interface'
import type { BillingOwner } from '~/domain/value-objects/billing-owner.vo'

import { UserId } from '~/domain/value-objects/user-id.vo'

import { getBillingMembershipRole } from './billing-access'

export class GetBillingSummaryUseCase {
  constructor(private readonly repository: IBillingRepository) {}

  async execute(input: { actorUserId: string; owner: BillingOwner }) {
    const actorId = UserId.create(input.actorUserId)
    const role = await getBillingMembershipRole(this.repository, input.owner, actorId)
    const account = await this.repository.getAccount(input.owner)
    account.assertAccessibleBy(actorId, role)
    return account.toSnapshot()
  }
}
