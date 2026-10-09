import type {
  BillingCheckoutCriteria,
  BillingPortalCriteria,
  IBillingRepository
} from '~/domain/repositories/billing.repository.interface'
import type { BillingOwner } from '~/domain/value-objects/billing-owner.vo'
import type { UserId } from '~/domain/value-objects/user-id.vo'

import {
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  getBillingSummary,
  handleRevenueCatWebhook,
  handleStripeWebhook,
  serverEnv
} from '@libs/billing-server'
import { prisma } from '@libs/pg-dao'

import { BillingAccount, BillingRedirect } from '~/domain/entities/billing-account.entity'

function toContractOwner(owner: BillingOwner) {
  return owner.kind === 'user'
    ? ({ kind: 'user', userId: owner.id } as const)
    : ({ kind: 'organization', organizationId: owner.id } as const)
}

export class BillingRepository implements IBillingRepository {
  async getAccount(owner: BillingOwner): Promise<BillingAccount> {
    const summary = await getBillingSummary(toContractOwner(owner))
    return new BillingAccount(
      owner,
      summary.map(customer => ({
        ...customer,
        owner: customer.owner,
        subscriptions: customer.subscriptions.map(subscription => ({
          ...subscription
        })),
        orders: customer.orders.map(order => ({ ...order }))
      }))
    )
  }

  async getOrganizationMembershipRole(organizationId: string, actorId: UserId): Promise<string | null> {
    const member = await prisma.member.findFirst({
      where: {
        organizationId,
        userId: actorId.getValue()
      },
      select: { role: true }
    })
    return member?.role ?? null
  }

  isOrganizationBillingEnabled(): boolean {
    return serverEnv.ORGANIZATION_BILLING_ENABLED
  }

  async createCheckout(criteria: BillingCheckoutCriteria): Promise<BillingRedirect> {
    const result = await createStripeCheckoutSession({
      ...criteria,
      owner: toContractOwner(criteria.owner)
    })
    return new BillingRedirect('stripe', result.url)
  }

  async createPortal(criteria: BillingPortalCriteria): Promise<BillingRedirect> {
    const result = await createStripeBillingPortalSession({
      ...criteria,
      owner: toContractOwner(criteria.owner)
    })
    return new BillingRedirect('stripe', result.url)
  }

  handleStripeWebhook(input: { payload: Buffer | string; signature: string }) {
    return handleStripeWebhook(input)
  }

  handleRevenueCatWebhook(input: { payload: Buffer | string | Record<string, unknown>; authorization?: string }) {
    return handleRevenueCatWebhook(input)
  }
}
