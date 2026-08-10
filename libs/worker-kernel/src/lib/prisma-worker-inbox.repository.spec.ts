import type { PrismaService } from '@libs/pg-dao'

import { describe, expect, it, vi } from 'vitest'

import { PrismaWorkerInboxRepository } from './prisma-worker-inbox.repository'

function createPrismaStub() {
  const queryRaw = vi.fn()
  const findUniqueOrThrow = vi.fn()
  const updateMany = vi.fn()
  const prisma = {
    $queryRaw: queryRaw,
    workerInbox: {
      findUniqueOrThrow,
      updateMany
    }
  } as unknown as PrismaService

  return { prisma, queryRaw, findUniqueOrThrow, updateMany }
}

const claim = {
  consumer: 'platform-smoke',
  messageId: 'evt_01',
  eventType: 'platform.smoke',
  envelopeVersion: 1,
  envelope: { id: 'evt_01' },
  maxAttempts: 5,
  now: new Date('2026-08-11T00:00:00.000Z')
}

describe('PrismaWorkerInboxRepository', () => {
  it('loads without initializing a database connection', async () => {
    vi.resetModules()
    vi.stubEnv('POSTGRES_DATABASE_URL', undefined)
    vi.stubEnv('POSGTRES_DATABASE_URL', undefined)

    await expect(import('./prisma-worker-inbox.repository')).resolves.toHaveProperty('PrismaWorkerInboxRepository')

    vi.unstubAllEnvs()
  })

  it('returns the attempt acquired by the atomic upsert', async () => {
    const { prisma, queryRaw, findUniqueOrThrow } = createPrismaStub()
    queryRaw.mockResolvedValue([{ attempt_count: 2 }])

    await expect(new PrismaWorkerInboxRepository(prisma).claim(claim)).resolves.toEqual({
      outcome: 'claimed',
      attemptCount: 2
    })
    expect(findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it.each([
    ['processed', 'processed'],
    ['dead_lettered', 'dead-lettered']
  ])('maps a %s record to a terminal duplicate', async (databaseStatus, terminalStatus) => {
    const { prisma, queryRaw, findUniqueOrThrow } = createPrismaStub()
    queryRaw.mockResolvedValue([])
    findUniqueOrThrow.mockResolvedValue({ status: databaseStatus, attemptCount: 3 })

    await expect(new PrismaWorkerInboxRepository(prisma).claim(claim)).resolves.toEqual({
      outcome: 'terminal',
      attemptCount: 3,
      status: terminalStatus
    })
  })

  it('reports a live or not-yet-due claim as busy', async () => {
    const { prisma, queryRaw, findUniqueOrThrow } = createPrismaStub()
    queryRaw.mockResolvedValue([])
    findUniqueOrThrow.mockResolvedValue({ status: 'retry_scheduled', attemptCount: 1 })

    await expect(new PrismaWorkerInboxRepository(prisma).claim(claim)).resolves.toEqual({
      outcome: 'busy',
      attemptCount: 1
    })
  })

  it('updates only the exact active attempt when completing work', async () => {
    const { prisma, updateMany } = createPrismaStub()
    updateMany.mockResolvedValue({ count: 1 })

    await new PrismaWorkerInboxRepository(prisma).markProcessed({
      consumer: claim.consumer,
      messageId: claim.messageId,
      attemptCount: 2,
      processedAt: claim.now
    })

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'processing', attemptCount: 2 }),
        data: expect.objectContaining({ status: 'processed', lockedAt: null })
      })
    )
  })

  it('fails closed when completion no longer owns the claim', async () => {
    const { prisma, updateMany } = createPrismaStub()
    updateMany.mockResolvedValue({ count: 0 })

    await expect(
      new PrismaWorkerInboxRepository(prisma).markProcessed({
        consumer: claim.consumer,
        messageId: claim.messageId,
        attemptCount: 2,
        processedAt: claim.now
      })
    ).rejects.toThrow('worker inbox complete lost its claim')
  })
})
