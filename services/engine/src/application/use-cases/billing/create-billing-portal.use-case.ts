import type { BillingPortalCriteria, IBillingRepository } from '~/domain/repositories/billing.repository.interface'

import { UserId } from '~/domain/value-objects/user-id.vo'

import { getBillingMembershipRole } from './billing-access'

export class CreateBillingPortalUseCase {
  constructor(private readonly repository: IBillingRepository) {}

  async execute(input: BillingPortalCriteria & { actorUserId: string }) {
    const actorId = UserId.create(input.actorUserId)
    const role = await getBillingMembershipRole(this.repository, input.owner, actorId)
    const account = await this.repository.getAccount(input.owner)
    account.assertManageableBy(actorId, role)
    return this.repository.createPortal(input)
  }
}
