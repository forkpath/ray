import type {
  WorkerEventHandler,
  WorkerInboxClaim,
  WorkerInboxClaimInput,
  WorkerInboxIdentity,
  WorkerInboxRepository
} from './worker-kernel'

import { describe, expect, it, vi } from 'vitest'

import {
  calculateRetryDelayMs,
  WorkerHandlerRegistry,
  WorkerMessageProcessor,
  WorkerReadinessProbe,
  WorkerRetryDispatcher
} from './worker-kernel'

const envelope = {
  id: 'evt_01',
  type: 'platform.smoke',
  version: 1 as const,
  occurredAt: '2026-08-11T00:00:00.000Z',
  correlationId: 'corr_01',
  actor: { userId: 'system:release-probe' },
  payload: { probe: true }
}

class InboxRepositoryStub implements WorkerInboxRepository {
  readonly claims: WorkerInboxClaimInput[] = []
  readonly deadLetters: Array<WorkerInboxIdentity & { readonly error: string; readonly failedAt: Date }> = []
  readonly processed: Array<WorkerInboxIdentity & { readonly processedAt: Date }> = []
  readonly retries: Array<WorkerInboxIdentity & { readonly error: string; readonly nextAttemptAt: Date }> = []
  claimResult: WorkerInboxClaim = { outcome: 'claimed', attemptCount: 1 }

  async claim(input: WorkerInboxClaimInput): Promise<WorkerInboxClaim> {
    this.claims.push(input)
    return this.claimResult
  }

  async isReady(): Promise<boolean> {
    return true
  }

  async markDeadLetter(
    input: WorkerInboxIdentity & { readonly error: string; readonly failedAt: Date }
  ): Promise<void> {
    this.deadLetters.push(input)
  }

  async markProcessed(input: WorkerInboxIdentity & { readonly processedAt: Date }): Promise<void> {
    this.processed.push(input)
  }

  async scheduleRetry(
    input: WorkerInboxIdentity & { readonly error: string; readonly nextAttemptAt: Date }
  ): Promise<void> {
    this.retries.push(input)
  }
}

function createHandler(handle = vi.fn().mockResolvedValue(undefined)): WorkerEventHandler {
  return {
    eventType: 'platform.smoke',
    supportedVersions: [1],
    handle
  }
}

function createProcessor(repository: InboxRepositoryStub, handler = createHandler()) {
  return new WorkerMessageProcessor(repository, new WorkerHandlerRegistry([handler]), {
    now: () => new Date('2026-08-11T00:00:10.000Z'),
    random: () => 0.5
  })
}

describe('WorkerMessageProcessor', () => {
  it('claims, handles and marks a message processed', async () => {
    const repository = new InboxRepositoryStub()
    const handler = createHandler()

    await expect(
      createProcessor(repository, handler).process({
        consumer: 'platform-smoke',
        deliveryId: 'delivery-1',
        message: envelope
      })
    ).resolves.toEqual({ status: 'processed', attemptCount: 1 })

    expect(handler.handle).toHaveBeenCalledWith(envelope)
    expect(repository.processed).toHaveLength(1)
  })

  it('returns a terminal duplicate without executing the handler', async () => {
    const repository = new InboxRepositoryStub()
    repository.claimResult = { outcome: 'terminal', status: 'processed', attemptCount: 1 }
    const handler = createHandler()

    await expect(
      createProcessor(repository, handler).process({
        consumer: 'platform-smoke',
        deliveryId: 'delivery-1',
        message: envelope
      })
    ).resolves.toEqual({ status: 'duplicate', terminalStatus: 'processed', attemptCount: 1 })
    expect(handler.handle).not.toHaveBeenCalled()
  })

  it('schedules an exponential retry with jitter after a transient failure', async () => {
    const repository = new InboxRepositoryStub()
    const handler = createHandler(vi.fn().mockRejectedValue(new Error('temporary')))

    await expect(
      createProcessor(repository, handler).process({
        consumer: 'platform-smoke',
        deliveryId: 'delivery-1',
        message: envelope
      })
    ).resolves.toEqual({
      status: 'retry-scheduled',
      attemptCount: 1,
      nextAttemptAt: new Date('2026-08-11T00:00:15.000Z')
    })
    expect(repository.retries[0]?.error).toBe('temporary')
  })

  it('dead-letters the fifth failed attempt', async () => {
    const repository = new InboxRepositoryStub()
    repository.claimResult = { outcome: 'claimed', attemptCount: 5 }
    const handler = createHandler(vi.fn().mockRejectedValue(new Error('permanent')))

    await expect(
      createProcessor(repository, handler).process({
        consumer: 'platform-smoke',
        deliveryId: 'delivery-1',
        message: envelope
      })
    ).resolves.toEqual({ status: 'dead-lettered', attemptCount: 5 })
    expect(repository.deadLetters[0]?.error).toBe('permanent')
    expect(repository.retries).toHaveLength(0)
  })

  it.each([
    [{ ...envelope, type: 'product.undefined' }, 'unknown event type: product.undefined'],
    [{ ...envelope, version: 2 }, 'unsupported envelope version 2 for platform.smoke']
  ])('dead-letters unsupported messages without invoking a handler', async (message, reason) => {
    const repository = new InboxRepositoryStub()
    const handler = createHandler()

    await expect(
      createProcessor(repository, handler).process({ consumer: 'platform-smoke', deliveryId: 'delivery-1', message })
    ).resolves.toEqual({ status: 'dead-lettered', attemptCount: 1 })
    expect(handler.handle).not.toHaveBeenCalled()
    expect(repository.deadLetters[0]?.error).toBe(reason)
  })

  it('uses the broker delivery id to quarantine malformed messages idempotently', async () => {
    const repository = new InboxRepositoryStub()

    await expect(
      createProcessor(repository).process({ consumer: 'platform-smoke', deliveryId: 'delivery-1', message: 'invalid' })
    ).resolves.toEqual({ status: 'dead-lettered', attemptCount: 1 })
    expect(repository.claims[0]).toMatchObject({ messageId: 'delivery-1', eventType: 'invalid', envelopeVersion: 0 })
  })
})

describe('worker retry and readiness policy', () => {
  it('bounds exponential backoff at five minutes and applies jitter', () => {
    expect(calculateRetryDelayMs(1, { random: () => 0 })).toBe(4_000)
    expect(calculateRetryDelayMs(1, { random: () => 0.5 })).toBe(5_000)
    expect(calculateRetryDelayMs(20, { random: () => 1 })).toBe(300_000)
  })

  it('claims due or abandoned work and reports durable republish failures', async () => {
    const repository = {
      claimDispatchable: vi.fn().mockResolvedValue([
        { consumer: 'platform-smoke', messageId: 'evt_01', envelope },
        { consumer: 'platform-smoke', messageId: 'evt_02', envelope: { ...envelope, id: 'evt_02' } }
      ])
    }
    const publisher = {
      publish: vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('broker unavailable'))
    }
    const dispatcher = new WorkerRetryDispatcher(repository, publisher, {
      batchSize: 10,
      dispatchLeaseMs: 30_000,
      processingLeaseMs: 120_000,
      now: () => new Date('2026-08-11T00:01:00.000Z')
    })

    await expect(dispatcher.dispatch()).resolves.toEqual({ claimed: 2, published: 1, failed: 1 })
    expect(repository.claimDispatchable).toHaveBeenCalledWith({
      now: new Date('2026-08-11T00:01:00.000Z'),
      dispatchLeaseExpiredAt: new Date('2026-08-11T00:00:30.000Z'),
      processingLeaseExpiredAt: new Date('2026-08-10T23:59:00.000Z'),
      limit: 10
    })
  })

  it('requires a registered handler and every dependency before standby is ready', async () => {
    const registry = new WorkerHandlerRegistry([createHandler()])
    const probe = new WorkerReadinessProbe('standby', registry, [
      { name: 'postgres', isReady: async () => true },
      { name: 'rabbitmq', isReady: async () => true }
    ])

    await expect(probe.inspect()).resolves.toEqual({
      ready: true,
      mode: 'standby',
      handlers: ['platform.smoke'],
      dependencies: { postgres: true, rabbitmq: true }
    })
  })

  it('reports a throwing dependency as not ready instead of failing the probe', async () => {
    const probe = new WorkerReadinessProbe('active', new WorkerHandlerRegistry([createHandler()]), [
      {
        name: 'postgres',
        isReady: async () => {
          throw new Error('connection refused')
        }
      }
    ])

    await expect(probe.inspect()).resolves.toMatchObject({
      ready: false,
      dependencies: { postgres: false }
    })
  })
})
