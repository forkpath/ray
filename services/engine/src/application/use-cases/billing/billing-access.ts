import type { IBillingRepository } from '~/domain/repositories/billing.repository.interface'
import type { BillingOwner } from '~/domain/value-objects/billing-owner.vo'
import type { UserId } from '~/domain/value-objects/user-id.vo'

import { OrganizationBillingDisabledException } from '~/domain/exceptions/billing.exception'

export async function getBillingMembershipRole(
  repository: IBillingRepository,
  owner: BillingOwner,
  actorId: UserId
): Promise<string | undefined> {
  if (owner.kind !== 'organization') return undefined
  if (!repository.isOrganizationBillingEnabled()) {
    throw new OrganizationBillingDisabledException()
  }
  return (await repository.getOrganizationMembershipRole(owner.id, actorId)) ?? undefined
}
