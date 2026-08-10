import type { EventEnvelopeV1 } from '@libs/event-contract'

import { parseEventEnvelopeMetadata, parseEventEnvelopeV1 } from '@libs/event-contract'

export const WORKER_MAX_ATTEMPTS = 5
export const WORKER_RETRY_BASE_MS = 5_000
export const WORKER_RETRY_MAX_MS = 300_000

export type WorkerRuntimeMode = 'active' | 'standby'
export type WorkerInboxTerminalStatus = 'processed' | 'dead-lettered'

export interface WorkerDelivery {
  readonly consumer: string
  readonly deliveryId: string
  readonly message: unknown
}

export interface WorkerEventHandler {
  readonly eventType: string
  readonly supportedVersions: readonly number[]
  handle(envelope: EventEnvelopeV1<unknown>): Promise<void>
}

export interface WorkerInboxClaimInput {
  readonly consumer: string
  readonly messageId: string
  readonly eventType: string
  readonly envelopeVersion: number
  readonly envelope: unknown
  readonly maxAttempts: number
  readonly now: Date
}

export type WorkerInboxClaim =
  | { readonly outcome: 'claimed'; readonly attemptCount: number }
  | { readonly outcome: 'busy'; readonly attemptCount: number }
  | {
      readonly outcome: 'terminal'
      readonly attemptCount: number
      readonly status: WorkerInboxTerminalStatus
    }

export interface WorkerInboxIdentity {
  readonly consumer: string
  readonly messageId: string
  readonly attemptCount: number
}

export interface WorkerInboxRepository {
  claim(input: WorkerInboxClaimInput): Promise<WorkerInboxClaim>
  markProcessed(input: WorkerInboxIdentity & { readonly processedAt: Date }): Promise<void>
  scheduleRetry(
    input: WorkerInboxIdentity & {
      readonly error: string
      readonly nextAttemptAt: Date
    }
  ): Promise<void>
  markDeadLetter(
    input: WorkerInboxIdentity & {
      readonly error: string
      readonly failedAt: Date
    }
  ): Promise<void>
  isReady(): Promise<boolean>
}

export interface WorkerRetryDelivery {
  readonly consumer: string
  readonly messageId: string
  readonly envelope: unknown
}

export interface WorkerRetryRepository {
  claimDispatchable(input: {
    readonly now: Date
    readonly dispatchLeaseExpiredAt: Date
    readonly processingLeaseExpiredAt: Date
    readonly limit: number
  }): Promise<readonly WorkerRetryDelivery[]>
}

export interface WorkerRetryPublisher {
  publish(delivery: WorkerRetryDelivery): Promise<void>
}

export interface WorkerRetryDispatchResult {
  readonly claimed: number
  readonly published: number
  readonly failed: number
}

export type WorkerMessageResult =
  | { readonly status: 'processed'; readonly attemptCount: number }
  | { readonly status: 'retry-scheduled'; readonly attemptCount: number; readonly nextAttemptAt: Date }
  | { readonly status: 'dead-lettered'; readonly attemptCount: number }
  | { readonly status: 'duplicate'; readonly attemptCount: number; readonly terminalStatus: WorkerInboxTerminalStatus }
  | { readonly status: 'busy'; readonly attemptCount: number }

export interface WorkerMessageProcessorOptions {
  readonly maxAttempts?: number
  readonly retryBaseMs?: number
  readonly retryMaxMs?: number
  readonly jitterRatio?: number
  readonly random?: () => number
  readonly now?: () => Date
}

export interface WorkerRetryDispatcherOptions {
  readonly batchSize?: number
  readonly dispatchLeaseMs?: number
  readonly processingLeaseMs?: number
  readonly now?: () => Date
}

export interface WorkerReadinessDependency {
  readonly name: string
  isReady(): Promise<boolean>
}

export interface WorkerReadinessResult {
  readonly ready: boolean
  readonly mode: WorkerRuntimeMode
  readonly handlers: readonly string[]
  readonly dependencies: Readonly<Record<string, boolean>>
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function validatePositiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`)
  }

  return value
}

export function calculateRetryDelayMs(
  attemptCount: number,
  {
    baseMs = WORKER_RETRY_BASE_MS,
    maxMs = WORKER_RETRY_MAX_MS,
    jitterRatio = 0.2,
    random = Math.random
  }: Pick<WorkerMessageProcessorOptions, 'retryBaseMs' | 'retryMaxMs' | 'jitterRatio' | 'random'> & {
    readonly baseMs?: number
    readonly maxMs?: number
  } = {}
): number {
  validatePositiveInteger(attemptCount, 'attemptCount')
  validatePositiveInteger(baseMs, 'baseMs')
  validatePositiveInteger(maxMs, 'maxMs')
  if (jitterRatio < 0 || jitterRatio > 1) {
    throw new Error('jitterRatio must be between 0 and 1')
  }

  const boundedRandom = Math.min(1, Math.max(0, random()))
  const exponentialDelay = Math.min(maxMs, baseMs * 2 ** (attemptCount - 1))
  const jitterMultiplier = 1 - jitterRatio + boundedRandom * jitterRatio * 2
  return Math.max(1, Math.min(maxMs, Math.round(exponentialDelay * jitterMultiplier)))
}

export class WorkerHandlerRegistry {
  private readonly handlers = new Map<string, WorkerEventHandler>()

  constructor(handlers: readonly WorkerEventHandler[]) {
    for (const handler of handlers) {
      if (this.handlers.has(handler.eventType)) {
        throw new Error(`duplicate worker handler: ${handler.eventType}`)
      }
      if (handler.supportedVersions.length === 0) {
        throw new Error(`worker handler ${handler.eventType} must support at least one envelope version`)
      }
      this.handlers.set(handler.eventType, handler)
    }
  }

  get(eventType: string): WorkerEventHandler | undefined {
    return this.handlers.get(eventType)
  }

  list(): readonly string[] {
    return [...this.handlers.keys()].sort()
  }
}

export class WorkerMessageProcessor {
  private readonly jitterRatio: number
  private readonly maxAttempts: number
  private readonly now: () => Date
  private readonly random: () => number
  private readonly retryBaseMs: number
  private readonly retryMaxMs: number

  constructor(
    private readonly repository: WorkerInboxRepository,
    private readonly registry: WorkerHandlerRegistry,
    options: WorkerMessageProcessorOptions = {}
  ) {
    this.maxAttempts = validatePositiveInteger(options.maxAttempts ?? WORKER_MAX_ATTEMPTS, 'maxAttempts')
    this.retryBaseMs = validatePositiveInteger(options.retryBaseMs ?? WORKER_RETRY_BASE_MS, 'retryBaseMs')
    this.retryMaxMs = validatePositiveInteger(options.retryMaxMs ?? WORKER_RETRY_MAX_MS, 'retryMaxMs')
    this.jitterRatio = options.jitterRatio ?? 0.2
    this.random = options.random ?? Math.random
    this.now = options.now ?? (() => new Date())
  }

  async process(delivery: WorkerDelivery): Promise<WorkerMessageResult> {
    let metadata: { readonly id: string; readonly type: string; readonly version: number }
    try {
      metadata = parseEventEnvelopeMetadata(delivery.message)
    } catch (error) {
      return this.deadLetterInvalid(delivery, getErrorMessage(error))
    }

    const claim = await this.repository.claim({
      consumer: delivery.consumer,
      messageId: metadata.id,
      eventType: metadata.type,
      envelopeVersion: metadata.version,
      envelope: delivery.message,
      maxAttempts: this.maxAttempts,
      now: this.now()
    })
    const terminal = this.toTerminalResult(claim)
    if (terminal) return terminal

    const handler = this.registry.get(metadata.type)
    if (!handler) {
      return this.deadLetterClaimed(
        delivery.consumer,
        metadata.id,
        claim.attemptCount,
        `unknown event type: ${metadata.type}`
      )
    }
    if (!handler.supportedVersions.includes(metadata.version)) {
      return this.deadLetterClaimed(
        delivery.consumer,
        metadata.id,
        claim.attemptCount,
        `unsupported envelope version ${metadata.version} for ${metadata.type}`
      )
    }

    let envelope: EventEnvelopeV1<unknown>
    try {
      envelope = parseEventEnvelopeV1(delivery.message)
    } catch (error) {
      return this.deadLetterClaimed(delivery.consumer, metadata.id, claim.attemptCount, getErrorMessage(error))
    }

    try {
      await handler.handle(envelope)
      await this.repository.markProcessed({
        consumer: delivery.consumer,
        messageId: metadata.id,
        attemptCount: claim.attemptCount,
        processedAt: this.now()
      })
      return { status: 'processed', attemptCount: claim.attemptCount }
    } catch (error) {
      const message = getErrorMessage(error)
      if (claim.attemptCount >= this.maxAttempts) {
        return this.deadLetterClaimed(delivery.consumer, metadata.id, claim.attemptCount, message)
      }

      const delayMs = calculateRetryDelayMs(claim.attemptCount, {
        baseMs: this.retryBaseMs,
        maxMs: this.retryMaxMs,
        jitterRatio: this.jitterRatio,
        random: this.random
      })
      const nextAttemptAt = new Date(this.now().getTime() + delayMs)
      await this.repository.scheduleRetry({
        consumer: delivery.consumer,
        messageId: metadata.id,
        attemptCount: claim.attemptCount,
        error: message,
        nextAttemptAt
      })
      return { status: 'retry-scheduled', attemptCount: claim.attemptCount, nextAttemptAt }
    }
  }

  private async deadLetterClaimed(
    consumer: string,
    messageId: string,
    attemptCount: number,
    error: string
  ): Promise<WorkerMessageResult> {
    await this.repository.markDeadLetter({
      consumer,
      messageId,
      attemptCount,
      error,
      failedAt: this.now()
    })
    return { status: 'dead-lettered', attemptCount }
  }

  private async deadLetterInvalid(delivery: WorkerDelivery, error: string): Promise<WorkerMessageResult> {
    const claim = await this.repository.claim({
      consumer: delivery.consumer,
      messageId: delivery.deliveryId,
      eventType: 'invalid',
      envelopeVersion: 0,
      envelope: delivery.message,
      maxAttempts: 1,
      now: this.now()
    })
    const terminal = this.toTerminalResult(claim)
    if (terminal) return terminal
    return this.deadLetterClaimed(delivery.consumer, delivery.deliveryId, claim.attemptCount, error)
  }

  private toTerminalResult(claim: WorkerInboxClaim): WorkerMessageResult | undefined {
    if (claim.outcome === 'busy') {
      return { status: 'busy', attemptCount: claim.attemptCount }
    }
    if (claim.outcome === 'terminal') {
      return {
        status: 'duplicate',
        attemptCount: claim.attemptCount,
        terminalStatus: claim.status
      }
    }
    return undefined
  }
}

export class WorkerRetryDispatcher {
  private readonly batchSize: number
  private readonly dispatchLeaseMs: number
  private readonly now: () => Date
  private readonly processingLeaseMs: number

  constructor(
    private readonly repository: WorkerRetryRepository,
    private readonly publisher: WorkerRetryPublisher,
    options: WorkerRetryDispatcherOptions = {}
  ) {
    this.batchSize = validatePositiveInteger(options.batchSize ?? 25, 'batchSize')
    this.dispatchLeaseMs = validatePositiveInteger(options.dispatchLeaseMs ?? 60_000, 'dispatchLeaseMs')
    this.processingLeaseMs = validatePositiveInteger(options.processingLeaseMs ?? 300_000, 'processingLeaseMs')
    this.now = options.now ?? (() => new Date())
  }

  async dispatch(): Promise<WorkerRetryDispatchResult> {
    const now = this.now()
    const deliveries = await this.repository.claimDispatchable({
      now,
      dispatchLeaseExpiredAt: new Date(now.getTime() - this.dispatchLeaseMs),
      processingLeaseExpiredAt: new Date(now.getTime() - this.processingLeaseMs),
      limit: this.batchSize
    })
    const results = await Promise.allSettled(deliveries.map(delivery => this.publisher.publish(delivery)))
    const published = results.filter(result => result.status === 'fulfilled').length
    return {
      claimed: deliveries.length,
      published,
      failed: deliveries.length - published
    }
  }
}

export class WorkerReadinessProbe {
  constructor(
    private readonly mode: WorkerRuntimeMode,
    private readonly registry: WorkerHandlerRegistry,
    private readonly dependencies: readonly WorkerReadinessDependency[]
  ) {}

  async inspect(): Promise<WorkerReadinessResult> {
    const dependencyEntries = await Promise.all(
      this.dependencies.map(async dependency => {
        try {
          return [dependency.name, await dependency.isReady()] as const
        } catch {
          return [dependency.name, false] as const
        }
      })
    )
    const dependencyState = Object.fromEntries(dependencyEntries)
    const handlers = this.registry.list()
    return {
      ready: handlers.length > 0 && Object.values(dependencyState).every(Boolean),
      mode: this.mode,
      handlers,
      dependencies: dependencyState
    }
  }
}
