import type { IBillingRepository } from '~/domain/repositories/billing.repository.interface'
import type { BillingOwner } from '~/domain/value-objects/billing-owner.vo'

import { describe, expect, it, vi } from 'vitest'

import { CreateBillingCheckoutUseCase } from '~/application/use-cases/billing/create-billing-checkout.use-case'
import { CreateBillingPortalUseCase } from '~/application/use-cases/billing/create-billing-portal.use-case'
import { GetBillingSummaryUseCase } from '~/application/use-cases/billing/get-billing-summary.use-case'
import { BillingAccount, BillingRedirect } from '~/domain/entities/billing-account.entity'
import {
  BillingAccessDeniedException,
  OrganizationBillingDisabledException
} from '~/domain/exceptions/billing.exception'
import { BillingOwner as BillingOwnerValue } from '~/domain/value-objects/billing-owner.vo'

function repositoryFixture(input: { owner: BillingOwner; enabled?: boolean; role?: string | null }) {
  const account = new BillingAccount(input.owner, [])
  const getAccount = vi.fn(async () => account)
  const getOrganizationMembershipRole = vi.fn(async () => input.role ?? null)
  const createCheckout = vi.fn(async () => new BillingRedirect('stripe', 'https://billing.test/checkout'))
  const createPortal = vi.fn(async () => new BillingRedirect('stripe', 'https://billing.test/portal'))

  const repository: IBillingRepository = {
    getAccount,
    getOrganizationMembershipRole,
    isOrganizationBillingEnabled: () => input.enabled ?? true,
    createCheckout,
    createPortal,
    handleStripeWebhook: vi.fn(async () => ({ received: true })),
    handleRevenueCatWebhook: vi.fn(async () => ({ received: true }))
  }

  return {
    repository,
    getAccount,
    getOrganizationMembershipRole,
    createCheckout,
    createPortal
  }
}

const organizationOwner = BillingOwnerValue.forOrganization('organization-1')

describe('organization billing use cases', () => {
  it('allows any organization member to read billing', async () => {
    const fixture = repositoryFixture({ owner: organizationOwner, role: 'member' })

    await expect(
      new GetBillingSummaryUseCase(fixture.repository).execute({
        actorUserId: 'member-1',
        owner: organizationOwner
      })
    ).resolves.toEqual([])
    expect(fixture.getOrganizationMembershipRole).toHaveBeenCalledTimes(1)
  })

  it('rejects organization reads from non-members', async () => {
    const fixture = repositoryFixture({ owner: organizationOwner, role: null })

    await expect(
      new GetBillingSummaryUseCase(fixture.repository).execute({
        actorUserId: 'outsider-1',
        owner: organizationOwner
      })
    ).rejects.toBeInstanceOf(BillingAccessDeniedException)
  })

  it('fails closed before reading membership when organization billing is disabled', async () => {
    const fixture = repositoryFixture({
      owner: organizationOwner,
      enabled: false,
      role: 'owner'
    })

    await expect(
      new GetBillingSummaryUseCase(fixture.repository).execute({
        actorUserId: 'owner-1',
        owner: organizationOwner
      })
    ).rejects.toBeInstanceOf(OrganizationBillingDisabledException)
    expect(fixture.getOrganizationMembershipRole).not.toHaveBeenCalled()
    expect(fixture.getAccount).not.toHaveBeenCalled()
  })

  it.each(['owner', 'admin'])('allows the %s role to manage organization billing', async role => {
    const fixture = repositoryFixture({ owner: organizationOwner, role })

    await new CreateBillingCheckoutUseCase(fixture.repository).execute({
      actorUserId: `${role}-1`,
      owner: organizationOwner,
      email: `${role}@example.test`,
      variantId: 'price-team',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel'
    })
    await new CreateBillingPortalUseCase(fixture.repository).execute({
      actorUserId: `${role}-1`,
      owner: organizationOwner,
      email: `${role}@example.test`,
      returnUrl: 'https://app.test/billing'
    })

    expect(fixture.createCheckout).toHaveBeenCalledTimes(1)
    expect(fixture.createPortal).toHaveBeenCalledTimes(1)
  })

  it('rejects ordinary members before creating Stripe sessions', async () => {
    const fixture = repositoryFixture({ owner: organizationOwner, role: 'member' })

    await expect(
      new CreateBillingCheckoutUseCase(fixture.repository).execute({
        actorUserId: 'member-1',
        owner: organizationOwner,
        email: 'member@example.test',
        variantId: 'price-team',
        successUrl: 'https://app.test/success',
        cancelUrl: 'https://app.test/cancel'
      })
    ).rejects.toBeInstanceOf(BillingAccessDeniedException)
    expect(fixture.createCheckout).not.toHaveBeenCalled()
  })
})
