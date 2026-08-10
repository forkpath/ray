import { randomUUID } from 'node:crypto'
import type {
  WorkerInboxClaim,
  WorkerInboxClaimInput,
  WorkerInboxIdentity,
  WorkerInboxRepository
} from './worker-kernel'
import type { PrismaService } from '@libs/pg-dao'

interface WorkerInboxClaimRow {
  readonly attempt_count: number
}

const workerClaimLeaseMs = 5 * 60 * 1000

function requireMutation(count: number, operation: string): void {
  if (count !== 1) {
    throw new Error(`worker inbox ${operation} lost its claim`)
  }
}

export class PrismaWorkerInboxRepository implements WorkerInboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async claim(input: WorkerInboxClaimInput): Promise<WorkerInboxClaim> {
    const leaseExpiredAt = new Date(input.now.getTime() - workerClaimLeaseMs)
    const envelope = JSON.stringify(input.envelope ?? null)
    const rows = await this.prisma.$queryRaw<WorkerInboxClaimRow[]>`
      INSERT INTO "public"."worker_inbox" (
        "id",
        "consumer",
        "message_id",
        "event_type",
        "envelope_version",
        "envelope",
        "status",
        "attempt_count",
        "max_attempts",
        "received_at",
        "locked_at",
        "updated_at"
      ) VALUES (
        ${randomUUID()},
        ${input.consumer},
        ${input.messageId},
        ${input.eventType},
        ${input.envelopeVersion},
        ${envelope}::jsonb,
        'processing',
        1,
        ${input.maxAttempts},
        ${input.now},
        ${input.now},
        ${input.now}
      )
      ON CONFLICT ("consumer", "message_id") DO UPDATE SET
        "status" = 'processing',
        "attempt_count" = "worker_inbox"."attempt_count" + 1,
        "locked_at" = ${input.now},
        "next_attempt_at" = NULL,
        "updated_at" = ${input.now}
      WHERE
        "worker_inbox"."attempt_count" < "worker_inbox"."max_attempts"
        AND (
          (
            "worker_inbox"."status" = 'retry_scheduled'
            AND "worker_inbox"."next_attempt_at" <= ${input.now}
          )
          OR (
            "worker_inbox"."status" = 'processing'
            AND "worker_inbox"."locked_at" <= ${leaseExpiredAt}
          )
          OR "worker_inbox"."status" = 'received'
        )
      RETURNING "attempt_count"
    `

    const claimed = rows[0]
    if (claimed) {
      return { outcome: 'claimed', attemptCount: claimed.attempt_count }
    }

    const existing = await this.prisma.workerInbox.findUniqueOrThrow({
      where: {
        consumer_messageId: {
          consumer: input.consumer,
          messageId: input.messageId
        }
      },
      select: {
        status: true,
        attemptCount: true
      }
    })

    if (existing.status === 'processed' || existing.status === 'dead_lettered') {
      return {
        outcome: 'terminal',
        attemptCount: existing.attemptCount,
        status: existing.status === 'processed' ? 'processed' : 'dead-lettered'
      }
    }

    return { outcome: 'busy', attemptCount: existing.attemptCount }
  }

  async isReady(): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ readonly ready: number }>>`SELECT 1 AS "ready"`
    return rows[0]?.ready === 1
  }

  async markDeadLetter(
    input: WorkerInboxIdentity & { readonly error: string; readonly failedAt: Date }
  ): Promise<void> {
    const result = await this.prisma.workerInbox.updateMany({
      where: {
        consumer: input.consumer,
        messageId: input.messageId,
        attemptCount: input.attemptCount,
        status: 'processing'
      },
      data: {
        status: 'dead_lettered',
        failedAt: input.failedAt,
        lastError: input.error,
        lockedAt: null,
        nextAttemptAt: null
      }
    })
    requireMutation(result.count, 'dead-letter')
  }

  async markProcessed(input: WorkerInboxIdentity & { readonly processedAt: Date }): Promise<void> {
    const result = await this.prisma.workerInbox.updateMany({
      where: {
        consumer: input.consumer,
        messageId: input.messageId,
        attemptCount: input.attemptCount,
        status: 'processing'
      },
      data: {
        status: 'processed',
        processedAt: input.processedAt,
        lastError: null,
        lockedAt: null,
        nextAttemptAt: null
      }
    })
    requireMutation(result.count, 'complete')
  }

  async scheduleRetry(
    input: WorkerInboxIdentity & { readonly error: string; readonly nextAttemptAt: Date }
  ): Promise<void> {
    const result = await this.prisma.workerInbox.updateMany({
      where: {
        consumer: input.consumer,
        messageId: input.messageId,
        attemptCount: input.attemptCount,
        status: 'processing'
      },
      data: {
        status: 'retry_scheduled',
        nextAttemptAt: input.nextAttemptAt,
        lastError: input.error,
        lockedAt: null
      }
    })
    requireMutation(result.count, 'retry scheduling')
  }
}
