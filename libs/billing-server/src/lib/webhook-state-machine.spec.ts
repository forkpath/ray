import { beforeEach, describe, expect, it, vi } from 'vitest'

import { runWebhookEvent, WebhookEventProcessingError } from './webhook-state-machine'

const { findUnique, findUniqueOrThrow, updateMany, upsert } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn()
}))

vi.mock('@libs/pg-dao', () => ({
  prisma: {
    webhookEvent: {
      findUnique,
      findUniqueOrThrow,
      updateMany,
      upsert
    }
  }
}))

const identity = {
  eventId: 'evt-1',
  provider: 'stripe',
  type: 'checkout.session.completed'
}

describe('webhook claim state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    upsert.mockResolvedValue({})
    findUnique.mockResolvedValue(null)
  })

  it('allows only one concurrent request to process an event', async () => {
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    findUniqueOrThrow.mockResolvedValue({ status: 'processing', attemptCount: 1 })
    let release: ((status: 'processed') => void) | undefined
    const process = vi.fn(
      () =>
        new Promise<'processed'>(resolve => {
          release = resolve
        })
    )

    const first = runWebhookEvent(identity, process)
    await vi.waitFor(() => expect(process).toHaveBeenCalledOnce())

    await expect(runWebhookEvent(identity, process)).rejects.toBeInstanceOf(WebhookEventProcessingError)
    expect(process).toHaveBeenCalledOnce()

    release?.('processed')
    await expect(first).resolves.toEqual({ status: 'processed', attemptCount: 1 })
    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        eventId: identity.eventId,
        provider: identity.provider,
        OR: [
          { status: { in: ['received', 'failed'] } },
          { status: 'processing', lastAttemptAt: null },
          { status: 'processing', lastAttemptAt: { lt: expect.any(Date) } }
        ]
      },
      data: {
        status: 'processing',
        error: null,
        processedAt: null,
        lastAttemptAt: expect.any(Date),
        attemptCount: { increment: 1 }
      }
    })
  })

  it('retries a failed event on the same unique record', async () => {
    updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
    findUniqueOrThrow
      .mockResolvedValueOnce({ status: 'processing', attemptCount: 1 })
      .mockResolvedValueOnce({ status: 'processing', attemptCount: 2 })
    const process = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary provider failure'))
      .mockResolvedValueOnce('processed')

    await expect(runWebhookEvent(identity, process)).rejects.toThrow('temporary provider failure')
    await expect(runWebhookEvent(identity, process)).resolves.toEqual({ status: 'processed', attemptCount: 2 })

    expect(upsert).toHaveBeenCalledTimes(2)
    expect(upsert.mock.calls[0]?.[0].where).toEqual(upsert.mock.calls[1]?.[0].where)
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        eventId: identity.eventId,
        provider: identity.provider,
        status: 'processing',
        attemptCount: 1
      },
      data: { status: 'failed', error: 'temporary provider failure', processedAt: null }
    })
  })

  it.each(['processed', 'skipped'] as const)('returns an idempotent duplicate for terminal status %s', async status => {
    updateMany.mockResolvedValueOnce({ count: 0 })
    findUniqueOrThrow.mockResolvedValue({ status, attemptCount: 3 })
    const process = vi.fn()

    await expect(runWebhookEvent(identity, process)).resolves.toEqual({
      status: 'duplicate',
      terminalStatus: status,
      attemptCount: 3
    })
    expect(process).not.toHaveBeenCalled()
  })

  it('records skipped events as completed claims', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 })
    findUniqueOrThrow.mockResolvedValue({ status: 'processing', attemptCount: 1 })

    await expect(runWebhookEvent(identity, async () => 'skipped')).resolves.toEqual({
      status: 'skipped',
      attemptCount: 1
    })
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        eventId: identity.eventId,
        provider: identity.provider,
        status: 'processing',
        attemptCount: 1
      },
      data: { status: 'skipped', error: null, processedAt: expect.any(Date) }
    })
  })
})
