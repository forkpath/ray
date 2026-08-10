import { createHash } from 'node:crypto'
import type { WorkerMessageProcessor, WorkerReadinessProbe, WorkerRetryDispatcher } from '@libs/worker-kernel'

import {
  Controller,
  Get,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException
} from '@nestjs/common'

import { AmqpConnection } from '@golevelup/nestjs-rabbitmq'

import { workerRuntimeConfig } from './worker-runtime.config'

export interface WorkerBrokerMessage {
  readonly content: Buffer
  readonly properties: {
    readonly correlationId?: string
    readonly messageId?: string
  }
}

export interface WorkerAckChannel {
  ack(message: WorkerBrokerMessage): void
  cancel(consumerTag: string): Promise<unknown>
  consume(
    queue: string,
    onMessage: (message: WorkerBrokerMessage | null) => void,
    options: { readonly consumerTag: string; readonly noAck: false }
  ): Promise<{ readonly consumerTag: string }>
  nack(message: WorkerBrokerMessage, allUpTo: false, requeue: boolean): void
}

interface WorkerManagedChannel {
  addSetup(setup: (channel: WorkerAckChannel) => Promise<void>): Promise<void>
  removeSetup(
    setup: (channel: WorkerAckChannel) => Promise<void>,
    teardown: (channel: WorkerAckChannel) => Promise<void>
  ): Promise<void>
}

function deliveryId(message: WorkerBrokerMessage): string {
  return (
    message.properties.messageId ||
    message.properties.correlationId ||
    `sha256:${createHash('sha256').update(message.content).digest('hex')}`
  )
}

@Injectable()
export class WorkerRabbitConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly consumerTag = `${workerRuntimeConfig.consumer}-consumer`
  private readonly inFlight = new Set<Promise<void>>()
  private readonly logger = new Logger(WorkerRabbitConsumer.name)
  private readonly managedChannel: WorkerManagedChannel

  constructor(
    private readonly processor: WorkerMessageProcessor,
    connection: AmqpConnection
  ) {
    this.managedChannel = connection.managedChannel as unknown as WorkerManagedChannel
  }

  private readonly setupConsumer = async (channel: WorkerAckChannel): Promise<void> => {
    await channel.consume(
      workerRuntimeConfig.queue,
      message => {
        if (!message) return
        const processing = this.consume(channel, message)
        this.inFlight.add(processing)
        void processing
          .catch(error => this.logger.error('Worker manual acknowledgement failed', error))
          .finally(() => this.inFlight.delete(processing))
      },
      { consumerTag: this.consumerTag, noAck: false }
    )
  }

  async onModuleInit(): Promise<void> {
    if (workerRuntimeConfig.mode === 'standby') return
    await this.managedChannel.addSetup(this.setupConsumer)
  }

  async onModuleDestroy(): Promise<void> {
    if (workerRuntimeConfig.mode === 'standby') return
    await this.managedChannel.removeSetup(this.setupConsumer, async channel => {
      await channel.cancel(this.consumerTag)
    })
    await Promise.allSettled(this.inFlight)
  }

  async consume(channel: WorkerAckChannel, rawMessage: WorkerBrokerMessage): Promise<void> {
    let message: unknown
    try {
      message = JSON.parse(rawMessage.content.toString('utf8'))
    } catch {
      message = rawMessage.content.toString('utf8')
    }

    try {
      const result = await this.processor.process({
        consumer: workerRuntimeConfig.consumer,
        deliveryId: deliveryId(rawMessage),
        message
      })
      if (
        result.status === 'dead-lettered' ||
        (result.status === 'duplicate' && result.terminalStatus === 'dead-lettered')
      ) {
        channel.nack(rawMessage, false, false)
        return
      }
      channel.ack(rawMessage)
    } catch (error) {
      this.logger.error('Worker delivery failed before a durable outcome was recorded', error)
      channel.nack(rawMessage, false, true)
    }
  }
}

@Injectable()
export class WorkerRetryRuntime implements OnModuleInit, OnModuleDestroy {
  private dispatching = false
  private interval: NodeJS.Timeout | undefined
  private readonly logger = new Logger(WorkerRetryRuntime.name)

  constructor(private readonly dispatcher: WorkerRetryDispatcher) {}

  onModuleInit(): void {
    if (workerRuntimeConfig.mode === 'standby') return
    this.interval = setInterval(() => void this.dispatchOnce(), workerRuntimeConfig.retryPollMs)
    this.interval.unref()
    void this.dispatchOnce()
  }

  onModuleDestroy(): void {
    if (this.interval) clearInterval(this.interval)
  }

  async dispatchOnce(): Promise<void> {
    if (this.dispatching) return
    this.dispatching = true
    try {
      const result = await this.dispatcher.dispatch()
      if (result.failed > 0) {
        this.logger.warn(`Worker retry dispatch published ${result.published}/${result.claimed}`)
      }
    } catch (error) {
      this.logger.error('Worker retry dispatch failed', error)
    } finally {
      this.dispatching = false
    }
  }
}

@Controller('health')
export class WorkerHealthController {
  constructor(private readonly readiness: WorkerReadinessProbe) {}

  @Get('live')
  live() {
    return { status: 'ok' as const }
  }

  @Get('ready')
  async ready() {
    const result = await this.readiness.inspect()
    if (!result.ready) throw new ServiceUnavailableException(result)
    return result
  }
}
