import type { CommandBus, QueryBus } from '@nestjs/cqrs'
import type { CheckoutDto } from '~/application/dtos/billing/billing.dto'

import { describe, expect, it, vi } from 'vitest'

import { CreateCheckoutSessionCommand } from '~/application/commands/billing/create-checkout-session.command'
import { GetBillingSummaryQuery } from '~/application/queries/billing/get-billing-summary.query'

import { BillingController, OrganizationBillingController } from './billing.controller'

const session = {
  user: {
    id: 'session-user',
    email: 'session-user@example.test',
    name: 'Session User'
  }
}

const checkoutDto = {
  variantId: 'price-team',
  successUrl: 'https://app.test/success',
  cancelUrl: 'https://app.test/cancel',
  ownerId: 'attacker-user',
  organizationId: 'attacker-organization'
} as CheckoutDto & { ownerId: string; organizationId: string }

function buses() {
  const commandExecute = vi.fn().mockResolvedValue({ provider: 'stripe', url: 'https://billing.test' })
  const queryExecute = vi.fn().mockResolvedValue([])
  return {
    commandBus: { execute: commandExecute } as unknown as CommandBus,
    queryBus: { execute: queryExecute } as unknown as QueryBus,
    commandExecute,
    queryExecute
  }
}

describe('billing controller ownership derivation', () => {
  it('always derives user billing ownership from the Better Auth session', async () => {
    const fixture = buses()
    const controller = new BillingController(fixture.commandBus, fixture.queryBus)

    await controller.createCheckoutSession(session, checkoutDto)

    const command = fixture.commandExecute.mock.calls[0]?.[0]
    expect(command).toBeInstanceOf(CreateCheckoutSessionCommand)
    expect(command.input).toMatchObject({
      actorUserId: 'session-user',
      email: 'session-user@example.test',
      owner: { kind: 'user', id: 'session-user' }
    })
    expect(command.input).not.toHaveProperty('ownerId')
    expect(command.input).not.toHaveProperty('organizationId')
  })

  it('always derives organization ownership from the route path', async () => {
    const fixture = buses()
    const controller = new OrganizationBillingController(fixture.commandBus, fixture.queryBus)

    await controller.createCheckoutSession(session, 'trusted-organization', checkoutDto)

    const command = fixture.commandExecute.mock.calls[0]?.[0]
    expect(command).toBeInstanceOf(CreateCheckoutSessionCommand)
    expect(command.input.owner).toMatchObject({
      kind: 'organization',
      id: 'trusted-organization'
    })
    expect(command.input).not.toHaveProperty('ownerId')
    expect(command.input).not.toHaveProperty('organizationId')
  })

  it('dispatches organization reads with the session actor and route owner', async () => {
    const fixture = buses()
    const controller = new OrganizationBillingController(fixture.commandBus, fixture.queryBus)

    await controller.getSummary(session, 'trusted-organization')

    const query = fixture.queryExecute.mock.calls[0]?.[0]
    expect(query).toBeInstanceOf(GetBillingSummaryQuery)
    expect(query.actorUserId).toBe('session-user')
    expect(query.owner).toMatchObject({
      kind: 'organization',
      id: 'trusted-organization'
    })
  })
})
