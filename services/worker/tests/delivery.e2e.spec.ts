import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'

import { NestFactory } from '@nestjs/core'

import { AmqpConnection } from '@golevelup/nestjs-rabbitmq'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prisma } from '@libs/pg-dao'
import {
  EventEnvelopeV1,
  PLATFORM_EVENT_EXCHANGE,
  PLATFORM_SMOKE_EVENT,
  PlatformSmokePayload
} from '@libs/platform-contract'

import { AppModule } from '~/app/app.module'
import { PlatformHandlerRegistry } from '~/app/platform-handler.registry'

import { startWorkerProcess } from './process-fixture'

describe('Worker real RabbitMQ delivery and Inbox', () => {
  let app: INestApplication
  let amqp: AmqpConnection
  const calls = new Map<string, number>()
  const failures = new Map<string, number>()
  let closed = false

  function event(): EventEnvelopeV1<PlatformSmokePayload> {
    return {
      id: randomUUID(),
      type: PLATFORM_SMOKE_EVENT,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: randomUUID(),
      actor: { userId: 'test-fixture' },
      payload: { probeId: randomUUID() }
    }
  }
  function state(id: string) {
    return prisma.inboxMessage.findUnique({
      where: { consumer_messageId: { consumer: 'worker.platform.v1', messageId: id } }
    })
  }

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false })
    app.get(PlatformHandlerRegistry).register<PlatformSmokePayload>(PLATFORM_SMOKE_EVENT, 1, async envelope => {
      const count = (calls.get(envelope.id) ?? 0) + 1
      calls.set(envelope.id, count)
      if (count <= (failures.get(envelope.id) ?? 0)) throw new Error('controlled handler failure')
    })
    await app.listen(0, '127.0.0.1')
    amqp = app.get(AmqpConnection)
  })
  afterAll(async () => {
    if (!closed) await app?.close()
    await prisma.$disconnect()
  })

  it('boots the full application with Mongo and reports its actual dependencies', async () => {
    const response = await fetch(`${await app.getUrl()}/ready`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ dependencies: { postgres: 'ready', rabbitmq: 'ready' } })
  })

  it('acks successful delivery and deduplicates repeated message IDs', async () => {
    const envelope = event()
    await Promise.all(
      Array.from({ length: 4 }, () => amqp.publish(PLATFORM_EVENT_EXCHANGE, PLATFORM_SMOKE_EVENT, envelope))
    )
    await expect.poll(async () => (await state(envelope.id))?.status).toBe('processed')
    // A barrier message verifies that the consumer continues after duplicates.
    const barrier = event()
    await amqp.publish(PLATFORM_EVENT_EXCHANGE, PLATFORM_SMOKE_EVENT, barrier)
    await expect.poll(async () => (await state(barrier.id))?.status).toBe('processed')
    expect(calls.get(envelope.id)).toBe(1)
    await expect.poll(async () => (await amqp.channel.checkQueue('platform.smoke')).messageCount).toBe(0)
  })

  it('retries a failed handler through the broker TTL queue and then succeeds', async () => {
    // A duplicate can wait on an active lease even after its owner completes.
    // Its long delay must not block the following short handler retry.
    const held = event()
    await prisma.inboxMessage.create({
      data: {
        id: randomUUID(),
        consumer: 'worker.platform.v1',
        messageId: held.id,
        eventType: held.type,
        version: 1,
        status: 'processing',
        attemptCount: 1,
        leaseUntil: new Date(Date.now() + 60_000)
      }
    })
    const initialLeaseRetries = (await amqp.channel.checkQueue('platform.smoke.retry.30000')).messageCount
    await amqp.publish(PLATFORM_EVENT_EXCHANGE, PLATFORM_SMOKE_EVENT, held)
    await expect
      .poll(async () => (await amqp.channel.checkQueue('platform.smoke.retry.30000')).messageCount)
      .toBeGreaterThan(initialLeaseRetries)
    await prisma.inboxMessage.update({
      where: { consumer_messageId: { consumer: 'worker.platform.v1', messageId: held.id } },
      data: { status: 'processed', leaseUntil: null }
    })
    const envelope = event()
    failures.set(envelope.id, 1)
    await amqp.publish(PLATFORM_EVENT_EXCHANGE, PLATFORM_SMOKE_EVENT, envelope, { persistent: true })
    await expect.poll(async () => (await state(envelope.id))?.status).toBe('retrying')
    await expect
      .poll(async () => {
        const counts: number[] = await Promise.all(
          [5000, 10000].map(
            async delay => (await amqp.channel.checkQueue(`platform.smoke.retry.${delay}`)).messageCount
          )
        )
        return counts.reduce((count, messages) => count + messages, 0)
      })
      .toBeGreaterThan(0)
    await expect.poll(async () => (await state(envelope.id))?.status, { timeout: 15_000 }).toBe('processed')
    expect(calls.get(envelope.id)).toBe(2)
    expect((await state(envelope.id))?.attemptCount).toBe(2)
    expect(calls.get(held.id)).toBeUndefined()
  })

  it('routes the exhausted final attempt and an unsupported envelope version to DLQ', async () => {
    const envelope = event()
    failures.set(envelope.id, Infinity)
    await amqp.publish(PLATFORM_EVENT_EXCHANGE, PLATFORM_SMOKE_EVENT, envelope, { headers: { 'x-attempt': 5 } })
    await expect.poll(async () => (await state(envelope.id))?.status).toBe('failed')
    await expect.poll(async () => (await amqp.channel.checkQueue('platform.smoke.dlq')).messageCount).toBe(1)
    const failed = await amqp.channel.get('platform.smoke.dlq', { noAck: false })
    expect(failed).not.toBe(false)
    if (failed) {
      expect(failed.properties.headers?.['x-dead-letter-reason']).toBe('controlled handler failure')
      expect(JSON.parse(failed.content.toString()).id).toBe(envelope.id)
      amqp.channel.ack(failed)
    }
    const unsupported = { ...event(), version: 2 }
    await amqp.publish(PLATFORM_EVENT_EXCHANGE, PLATFORM_SMOKE_EVENT, unsupported)
    await expect.poll(async () => (await amqp.channel.checkQueue('platform.smoke.dlq')).messageCount).toBe(1)
    const rejected = await amqp.channel.get('platform.smoke.dlq', { noAck: false })
    expect(rejected).not.toBe(false)
    if (rejected) {
      expect(rejected.properties.headers?.['x-dead-letter-reason']).toBe('unsupported-or-invalid-envelope')
      amqp.channel.ack(rejected)
    }
    expect(await state(unsupported.id)).toBeNull()
  })

  it('retains redelivery while a previous process lease is still active', async () => {
    const envelope = event()
    await prisma.inboxMessage.create({
      data: {
        id: randomUUID(),
        consumer: 'worker.platform.v1',
        messageId: envelope.id,
        eventType: envelope.type,
        version: 1,
        status: 'processing',
        attemptCount: 1,
        leaseUntil: new Date(Date.now() + 2000)
      }
    })
    await amqp.publish(PLATFORM_EVENT_EXCHANGE, PLATFORM_SMOKE_EVENT, envelope)
    await expect.poll(async () => (await state(envelope.id))?.status, { timeout: 15_000 }).toBe('processed')
    expect(calls.get(envelope.id)).toBe(1)
    expect((await state(envelope.id))?.attemptCount).toBe(2)
  })

  it('recovers an unacknowledged delivery after an actual process crash and restart', async () => {
    await app.close()
    closed = true
    const children: Awaited<ReturnType<typeof startWorkerProcess>>[] = []
    try {
      const first = await startWorkerProcess(true)
      children.push(first)
      const envelope = event()
      const vhost = process.env.RAY_TEST_DATABASE
      if (!vhost) throw new Error('Missing isolated RabbitMQ vhost')
      const authorization = `Basic ${Buffer.from(`ray_test:${process.env.RAY_TEST_PASSWORD}`).toString('base64')}`
      const response = await fetch(
        `${process.env.RAY_TEST_RABBITMQ_MANAGEMENT}/api/exchanges/${encodeURIComponent(vhost)}/${PLATFORM_EVENT_EXCHANGE}/publish`,
        {
          method: 'POST',
          headers: { authorization, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            properties: { delivery_mode: 2 },
            routing_key: PLATFORM_SMOKE_EVENT,
            payload: JSON.stringify(envelope),
            payload_encoding: 'string'
          })
        }
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ routed: true })
      expect(await first.waitFor('handling')).toMatchObject({ id: envelope.id })
      expect((await state(envelope.id))?.status).toBe('processing')
      await first.stop('SIGKILL')
      // Advance only the fixture's lease, keeping real process/broker clocks.
      await prisma.inboxMessage.update({
        where: { consumer_messageId: { consumer: 'worker.platform.v1', messageId: envelope.id } },
        data: { leaseUntil: new Date(Date.now() - 1000) }
      })
      children.push(await startWorkerProcess(false))
      await expect.poll(async () => (await state(envelope.id))?.status, { timeout: 15_000 }).toBe('processed')
      expect((await state(envelope.id))?.attemptCount).toBe(2)
    } finally {
      for (const child of children.reverse()) await child.stop()
    }
  }, 90_000)
})
