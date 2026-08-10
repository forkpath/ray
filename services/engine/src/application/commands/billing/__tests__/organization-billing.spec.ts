import { ForbiddenException, NotFoundException } from '@nestjs/common'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  GetOrganizationBillingSummaryHandler,
  GetOrganizationBillingSummaryQuery
} from '../../../queries/billing/get-billing-summary.query'
import { BillingService } from '../../../services/billing.service'
import { UserOrganizationAccessService } from '../../../services/user-organization-access.service'
import {
  CreateOrganizationBillingPortalCommand,
  CreateOrganizationBillingPortalHandler
} from '../create-billing-portal.command'
import {
  CreateOrganizationCheckoutSessionCommand,
  CreateOrganizationCheckoutSessionHandler
} from '../create-checkout-session.command'

const billingService = {
  assertOrganizationBillingEnabled: vi.fn(),
  getSummary: vi.fn(),
  createCheckoutSession: vi.fn(),
  createBillingPortal: vi.fn()
}

const accessService = {
  ensureMember: vi.fn(),
  ensureBillingManagementAccess: vi.fn()
}

const billing = billingService as unknown as BillingService
const access = accessService as unknown as UserOrganizationAccessService

describe('organization billing application authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('allows a member to read only the organization selected by the path', async () => {
    accessService.ensureMember.mockResolvedValue('member')
    billingService.getSummary.mockResolvedValue([])
    const handler = new GetOrganizationBillingSummaryHandler(billing, access)

    await expect(handler.execute(new GetOrganizationBillingSummaryQuery('org-1', 'user-1'))).resolves.toEqual([])

    expect(billingService.assertOrganizationBillingEnabled).toHaveBeenCalledOnce()
    expect(accessService.ensureMember).toHaveBeenCalledWith('org-1', 'user-1')
    expect(billingService.getSummary).toHaveBeenCalledWith({ kind: 'organization', organizationId: 'org-1' })
  })

  it('fails before membership lookup while organization billing is disabled', async () => {
    billingService.assertOrganizationBillingEnabled.mockImplementation(() => {
      throw new NotFoundException('Organization billing is not enabled')
    })
    const handler = new GetOrganizationBillingSummaryHandler(billing, access)

    await expect(handler.execute(new GetOrganizationBillingSummaryQuery('org-1', 'user-1'))).rejects.toThrow(
      'Organization billing is not enabled'
    )
    expect(accessService.ensureMember).not.toHaveBeenCalled()
    expect(billingService.getSummary).not.toHaveBeenCalled()
  })

  it('derives organization checkout ownership from the path and actor', async () => {
    accessService.ensureBillingManagementAccess.mockResolvedValue(undefined)
    billingService.createCheckoutSession.mockResolvedValue({ provider: 'stripe', url: 'https://stripe.test' })
    const handler = new CreateOrganizationCheckoutSessionHandler(billing, access)
    const request = {
      variantId: 'premium-monthly',
      successUrl: 'https://app.test/success',
      cancelUrl: 'https://app.test/cancel'
    }

    await handler.execute(
      new CreateOrganizationCheckoutSessionCommand('org-1', { userId: 'user-1', email: 'owner@example.test' }, request)
    )

    expect(accessService.ensureBillingManagementAccess).toHaveBeenCalledWith('org-1', 'user-1')
    expect(billingService.createCheckoutSession).toHaveBeenCalledWith({
      owner: { kind: 'organization', organizationId: 'org-1' },
      email: 'owner@example.test',
      ...request
    })
  })

  it('does not create checkout when organization management access is denied', async () => {
    accessService.ensureBillingManagementAccess.mockRejectedValue(new ForbiddenException('denied'))
    const handler = new CreateOrganizationCheckoutSessionHandler(billing, access)

    await expect(
      handler.execute(
        new CreateOrganizationCheckoutSessionCommand(
          'org-1',
          { userId: 'member-1', email: 'member@example.test' },
          {
            variantId: 'premium-monthly',
            successUrl: 'https://app.test/success',
            cancelUrl: 'https://app.test/cancel'
          }
        )
      )
    ).rejects.toThrow('denied')
    expect(billingService.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('derives organization portal ownership from the path and actor', async () => {
    accessService.ensureBillingManagementAccess.mockResolvedValue(undefined)
    billingService.createBillingPortal.mockResolvedValue({ provider: 'stripe', url: 'https://stripe.test' })
    const handler = new CreateOrganizationBillingPortalHandler(billing, access)

    await handler.execute(
      new CreateOrganizationBillingPortalCommand(
        'org-1',
        { userId: 'admin-1', email: 'admin@example.test' },
        { returnUrl: 'https://app.test/billing' }
      )
    )

    expect(accessService.ensureBillingManagementAccess).toHaveBeenCalledWith('org-1', 'admin-1')
    expect(billingService.createBillingPortal).toHaveBeenCalledWith({
      owner: { kind: 'organization', organizationId: 'org-1' },
      email: 'admin@example.test',
      returnUrl: 'https://app.test/billing'
    })
  })
})
