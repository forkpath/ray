import type { WorkerAckChannel, WorkerBrokerMessage } from './worker-runtime.service'
import type { AmqpConnection } from '@golevelup/nestjs-rabbitmq'
import type { WorkerMessageProcessor, WorkerReadinessProbe, WorkerRetryDispatcher } from '@libs/worker-kernel'

import { ServiceUnavailableException } from '@nestjs/common'

import { describe, expect, it, vi } from 'vitest'

import { WorkerHealthController, WorkerRabbitConsumer, WorkerRetryRuntime } from './worker-runtime.service'

function rawMessage(): WorkerBrokerMessage {
  return {
    content: Buffer.from('{"id":"evt_01"}'),
    properties: { messageId: 'delivery-01' }
  }
}

function runtimeStubs() {
  const channel = {
    ack: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn().mockResolvedValue({ consumerTag: 'platform-worker-v1-consumer' }),
    nack: vi.fn()
  } satisfies WorkerAckChannel
  const managedChannel = {
    addSetup: vi.fn().mockImplementation(setup => setup(channel)),
    removeSetup: vi.fn().mockImplementation((_setup, teardown) => teardown(channel))
  }
  const connection = { managedChannel } as unknown as AmqpConnection
  return { channel, connection, managedChannel }
}

describe('WorkerRabbitConsumer', () => {
  it.each([
    [{ status: 'dead-lettered', attemptCount: 5 }, false],
    [{ status: 'duplicate', terminalStatus: 'dead-lettered', attemptCount: 5 }, false]
  ])('routes a terminal poison delivery through the broker DLQ', async (result, requeue) => {
    const processor = { process: vi.fn().mockResolvedValue(result) } as unknown as WorkerMessageProcessor
    const { channel, connection } = runtimeStubs()
    await new WorkerRabbitConsumer(processor, connection).consume(channel, rawMessage())

    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, requeue)
    expect(channel.ack).not.toHaveBeenCalled()
  })

  it('acks processed, duplicate, busy and durably scheduled retry outcomes', async () => {
    for (const result of [
      { status: 'processed', attemptCount: 1 },
      { status: 'duplicate', terminalStatus: 'processed', attemptCount: 1 },
      { status: 'busy', attemptCount: 1 },
      { status: 'retry-scheduled', attemptCount: 1, nextAttemptAt: new Date() }
    ]) {
      const processor = { process: vi.fn().mockResolvedValue(result) } as unknown as WorkerMessageProcessor
      const { channel, connection } = runtimeStubs()
      await new WorkerRabbitConsumer(processor, connection).consume(channel, rawMessage())
      expect(channel.ack).toHaveBeenCalledOnce()
      expect(channel.nack).not.toHaveBeenCalled()
    }
  })

  it('requeues when processing fails before recording a durable outcome', async () => {
    const processor = {
      process: vi.fn().mockRejectedValue(new Error('postgres unavailable'))
    } as unknown as WorkerMessageProcessor
    const { channel, connection } = runtimeStubs()
    await new WorkerRabbitConsumer(processor, connection).consume(channel, rawMessage())

    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true)
  })

  it('registers a reconnectable consumer and cancels it during drain', async () => {
    const processor = {
      process: vi.fn().mockResolvedValue({ status: 'processed', attemptCount: 1 })
    } as unknown as WorkerMessageProcessor
    const { channel, connection, managedChannel } = runtimeStubs()
    const consumer = new WorkerRabbitConsumer(processor, connection)

    await consumer.onModuleInit()
    expect(managedChannel.addSetup).toHaveBeenCalledOnce()
    expect(channel.consume).toHaveBeenCalledWith(
      'platform-worker-v1',
      expect.any(Function),
      expect.objectContaining({ noAck: false })
    )

    await consumer.onModuleDestroy()
    expect(channel.cancel).toHaveBeenCalledWith('platform-worker-v1-consumer')
    expect(managedChannel.removeSetup).toHaveBeenCalledOnce()
  })

  it('uses a stable content hash when the broker message has no identifier', async () => {
    const processor = {
      process: vi.fn().mockResolvedValue({ status: 'processed', attemptCount: 1 })
    } as unknown as WorkerMessageProcessor
    const { channel, connection } = runtimeStubs()
    const consumer = new WorkerRabbitConsumer(processor, connection)

    await consumer.consume(channel, { content: Buffer.from('not-json'), properties: {} })

    expect(processor.process).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryId: 'sha256:0c21a879c732a67910d80988df4919d794f6a070aab610ef865032a28046b021',
        message: 'not-json'
      })
    )
  })
})

describe('WorkerRetryRuntime', () => {
  it('prevents overlapping retry scans', async () => {
    let release: (() => void) | undefined
    const dispatch = vi.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          release = () => resolve({ claimed: 0, published: 0, failed: 0 })
        })
    )
    const runtime = new WorkerRetryRuntime({ dispatch } as unknown as WorkerRetryDispatcher)

    const first = runtime.dispatchOnce()
    await runtime.dispatchOnce()
    expect(dispatch).toHaveBeenCalledTimes(1)
    release?.()
    await first
  })
})

describe('WorkerHealthController', () => {
  it('returns detailed readiness and rejects an unhealthy dependency', async () => {
    const healthy = {
      ready: true,
      mode: 'standby',
      handlers: ['platform.smoke'],
      dependencies: { postgres: true, rabbitmq: true }
    } as const
    const controller = new WorkerHealthController({
      inspect: vi.fn().mockResolvedValue(healthy)
    } as unknown as WorkerReadinessProbe)
    await expect(controller.ready()).resolves.toEqual(healthy)

    const unhealthyController = new WorkerHealthController({
      inspect: vi
        .fn()
        .mockResolvedValue({ ...healthy, ready: false, dependencies: { postgres: true, rabbitmq: false } })
    } as unknown as WorkerReadinessProbe)
    await expect(unhealthyController.ready()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
