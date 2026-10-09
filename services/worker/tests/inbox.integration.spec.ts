import { randomUUID } from 'node:crypto'

import { afterAll, describe, expect, it } from 'vitest'

import { prisma, PrismaService } from '@libs/pg-dao'

import { InboxService } from '~/app/inbox.service'

describe('Inbox claims against PostgreSQL', () => {
  const inbox = new InboxService(prisma as PrismaService)
  afterAll(() => prisma.$disconnect())

  it('allows only one concurrent claim, preserves completed deduplication and recovers an expired lease', async () => {
    const input = { consumer: 'integration', messageId: randomUUID(), eventType: 'platform.smoke', version: 1 }
    const key = { consumer: input.consumer, messageId: input.messageId }
    const claims = await Promise.all(Array.from({ length: 8 }, () => inbox.claim(input)))
    expect(claims.filter(Boolean)).toHaveLength(1)
    await prisma.inboxMessage.update({
      where: { consumer_messageId: key },
      data: { leaseUntil: new Date(Date.now() - 1000) }
    })
    expect(await inbox.claim(input)).toBe(2)
    // Completion by the old owner must not overwrite a newer lease.
    expect(await inbox.complete(input.consumer, input.messageId, 1)).toBe(false)
    expect(await inbox.fail(input.consumer, input.messageId, 'stale failure', true, 1)).toBe(false)
    expect(await inbox.complete(input.consumer, input.messageId, 2)).toBe(true)
    expect(await inbox.claim(input)).toBeUndefined()
    expect(await prisma.inboxMessage.findUnique({ where: { consumer_messageId: key } })).toMatchObject({
      status: 'processed',
      attemptCount: 2,
      leaseUntil: null
    })
  })
})
