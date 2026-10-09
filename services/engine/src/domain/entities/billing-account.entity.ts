import { BillingAccessDeniedException } from '~/domain/exceptions/billing.exception'
import { BillingOwner } from '~/domain/value-objects/billing-owner.vo'
import { UserId } from '~/domain/value-objects/user-id.vo'

export interface BillingCustomerSnapshot {
  id: string
  referenceId: string
  userId?: string | null
  organizationId?: string | null
  externalId: string
  provider: string
  createdAt: Date
  updatedAt: Date
  owner: { kind: 'user'; userId: string } | { kind: 'organization'; organizationId: string }
  subscriptions: ReadonlyArray<Record<string, unknown>>
  orders: ReadonlyArray<Record<string, unknown>>
}

export class BillingAccount {
  constructor(
    public readonly owner: BillingOwner,
    private readonly customers: readonly BillingCustomerSnapshot[]
  ) {}

  assertAccessibleBy(actorId: UserId, membershipRole?: string): void {
    if (this.owner.isOwnedBy(actorId)) return
    if (this.owner.kind === 'organization' && membershipRole) return
    throw new BillingAccessDeniedException(this.owner.id)
  }

  assertManageableBy(actorId: UserId, membershipRole?: string): void {
    if (this.owner.isOwnedBy(actorId)) return
    const roles = new Set(
      (membershipRole ?? '')
        .split(',')
        .map(role => role.trim())
        .filter(Boolean)
    )
    if (roles.has('owner') || roles.has('admin')) return
    throw new BillingAccessDeniedException(this.owner.id)
  }

  toSnapshot(): readonly BillingCustomerSnapshot[] {
    return this.customers
  }
}

export class BillingRedirect {
  constructor(
    public readonly provider: 'stripe',
    public readonly url: string | null
  ) {}
}
