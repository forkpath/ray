import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { AmqpConnection } from '@golevelup/nestjs-rabbitmq'

import { PgDaoModule, PrismaService } from '@libs/pg-dao'
import { RabbitmqModule } from '@libs/server-rabbitmq'
import {
  PrismaWorkerInboxRepository,
  WorkerHandlerRegistry,
  WorkerMessageProcessor,
  WorkerReadinessProbe,
  WorkerRetryDispatcher
} from '@libs/worker-kernel'

import { PlatformSmokeHandler } from './platform-smoke.handler'
import { workerRuntimeConfig } from './worker-runtime.config'
import { WorkerHealthController, WorkerRabbitConsumer, WorkerRetryRuntime } from './worker-runtime.service'

const workerConfig = () => ({
  rabbitmq: {
    uri: process.env['RABBITMQ_URI'] || 'amqp://localhost:5672',
    exchangeName: process.env['RABBITMQ_EXCHANGE_NAME'] || 'core',
    exchangeType: (process.env['RABBITMQ_EXCHANGE_TYPE'] as 'direct' | 'topic' | 'fanout') || 'direct'
  },
  worker: {
    ...workerRuntimeConfig
  }
})

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [workerConfig]
    }),
    PgDaoModule.register(),
    RabbitmqModule.register({
      registerHandlers: false,
      prefetchCount: workerRuntimeConfig.concurrency,
      exchanges: [
        {
          name: workerRuntimeConfig.deadLetterExchange,
          type: 'direct',
          options: { durable: true }
        }
      ],
      queues: [
        {
          name: workerRuntimeConfig.queue,
          exchange: workerRuntimeConfig.exchange,
          routingKey: workerRuntimeConfig.routingKey,
          options: {
            durable: true,
            deadLetterExchange: workerRuntimeConfig.deadLetterExchange,
            deadLetterRoutingKey: workerRuntimeConfig.deadLetterRoutingKey
          }
        },
        {
          name: workerRuntimeConfig.deadLetterQueue,
          exchange: workerRuntimeConfig.deadLetterExchange,
          routingKey: workerRuntimeConfig.deadLetterRoutingKey,
          options: { durable: true }
        }
      ]
    })
  ],
  controllers: [WorkerHealthController],
  providers: [
    PlatformSmokeHandler,
    {
      provide: PrismaWorkerInboxRepository,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaWorkerInboxRepository(prisma)
    },
    {
      provide: WorkerHandlerRegistry,
      inject: [PlatformSmokeHandler],
      useFactory: (handler: PlatformSmokeHandler) => new WorkerHandlerRegistry([handler])
    },
    {
      provide: WorkerMessageProcessor,
      inject: [PrismaWorkerInboxRepository, WorkerHandlerRegistry],
      useFactory: (repository: PrismaWorkerInboxRepository, registry: WorkerHandlerRegistry) =>
        new WorkerMessageProcessor(repository, registry)
    },
    {
      provide: WorkerRetryDispatcher,
      inject: [PrismaWorkerInboxRepository, AmqpConnection],
      useFactory: (repository: PrismaWorkerInboxRepository, connection: AmqpConnection) =>
        new WorkerRetryDispatcher(
          repository,
          {
            publish: async delivery => {
              await connection.publish(
                workerRuntimeConfig.exchange,
                workerRuntimeConfig.routingKey,
                delivery.envelope,
                {
                  persistent: true,
                  messageId: delivery.messageId
                }
              )
            }
          },
          { batchSize: workerRuntimeConfig.batchSize }
        )
    },
    {
      provide: WorkerReadinessProbe,
      inject: [WorkerHandlerRegistry, PrismaWorkerInboxRepository, AmqpConnection],
      useFactory: (
        registry: WorkerHandlerRegistry,
        repository: PrismaWorkerInboxRepository,
        connection: AmqpConnection
      ) =>
        new WorkerReadinessProbe(workerRuntimeConfig.mode, registry, [
          { name: 'postgres', isReady: () => repository.isReady() },
          { name: 'rabbitmq', isReady: async () => connection.connected }
        ])
    },
    WorkerRabbitConsumer,
    WorkerRetryRuntime
  ]
})
export class AppModule {}
