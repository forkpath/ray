import type { RabbitMQExchangeConfig, RabbitMQQueueConfig } from '@golevelup/nestjs-rabbitmq'
import type { RabbitmqConfig } from '@libs/server-kernel'

import { DynamicModule, Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { MessageHandlerErrorBehavior, RabbitMQConfig, RabbitMQModule } from '@golevelup/nestjs-rabbitmq'

import { MsgPubService } from './msg-pub.service'

export function parsePrefetchCount(value: string | undefined): number {
  const parsed = Number(value ?? 5)
  if (!Number.isInteger(parsed) || parsed < 1) return 5
  return Math.min(parsed, 16)
}

export interface RabbitmqModuleOptions {
  readonly exchanges?: readonly RabbitMQExchangeConfig[]
  readonly prefetchCount?: number
  readonly queues?: readonly RabbitMQQueueConfig[]
  readonly registerHandlers?: boolean
}

export function createRabbitmqConfig(conf: RabbitmqConfig, options: RabbitmqModuleOptions = {}): RabbitMQConfig {
  return {
    uri: conf.uri,
    exchanges: [
      {
        name: conf.exchangeName,
        type: conf.exchangeType
      },
      ...(options.exchanges ?? [])
    ],
    queues: [...(options.queues ?? [])],
    connectionInitOptions: {
      wait: true,
      timeout: 20000,
      reject: true
    },
    enableControllerDiscovery: true,
    registerHandlers: options.registerHandlers ?? true,
    connectionManagerOptions: {
      heartbeatIntervalInSeconds: 60,
      reconnectTimeInSeconds: 5
    },
    defaultRpcTimeout: 10000,
    channels: {
      default: {
        prefetchCount: options.prefetchCount ?? parsePrefetchCount(process.env['WORKER_CONCURRENCY']),
        default: true
      }
    },
    defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
    defaultRpcErrorHandler: error => {
      throw error
    }
  }
}

@Global()
@Module({})
export class RabbitmqModule {
  static register(options: RabbitmqModuleOptions = {}): DynamicModule {
    return {
      module: RabbitmqModule,
      imports: [
        RabbitMQModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService): RabbitMQConfig => {
            const conf = configService.get<RabbitmqConfig>('rabbitmq') as RabbitmqConfig
            return createRabbitmqConfig(conf, options)
          }
        })
      ],
      providers: [MsgPubService],
      exports: [RabbitMQModule, MsgPubService]
    }
  }
}
