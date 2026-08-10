import type { RabbitmqConfig } from '@libs/server-kernel'

import { DynamicModule, Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { MessageHandlerErrorBehavior, RabbitMQConfig, RabbitMQModule } from '@golevelup/nestjs-rabbitmq'

import { MsgPubService } from './msg-pub.service'

function parsePrefetchCount(value: string | undefined): number {
  const parsed = Number(value ?? 5)
  if (!Number.isInteger(parsed) || parsed < 1) return 5
  return Math.min(parsed, 16)
}

@Global()
@Module({})
export class RabbitmqModule {
  static register(): DynamicModule {
    return {
      module: RabbitmqModule,
      imports: [
        RabbitMQModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService): RabbitMQConfig => {
            const conf = configService.get<RabbitmqConfig>('rabbitmq') as RabbitmqConfig
            return {
              uri: conf.uri,
              exchanges: [
                {
                  name: conf.exchangeName,
                  type: conf.exchangeType
                }
              ],
              connectionInitOptions: {
                wait: true, // 等待链接建立
                timeout: 20000, // 等待20秒
                reject: true // 如果无法访问broker，拒绝连接
              },
              enableControllerDiscovery: true, // 启用控制器发现
              connectionManagerOptions: {
                heartbeatIntervalInSeconds: 60, // 每60秒发送一次心跳
                reconnectTimeInSeconds: 5 // 尝试每5秒重新连接一次
              },
              defaultRpcTimeout: 10000, // rpc超时为10秒
              channels: {
                default: {
                  prefetchCount: parsePrefetchCount(process.env['WORKER_CONCURRENCY']),
                  default: true
                }
              },
              // MessageHandlerErrorBehavior.ACK     // 确认消息（即使失败也认为已处理）
              // MessageHandlerErrorBehavior.NACK    // 拒绝消息并重新入队（重试）
              // MessageHandlerErrorBehavior.REQUEUE // 与 NACK 类似，重新入队
              // MessageHandlerErrorBehavior.REJECT  // 拒绝消息且不重新入队（直接丢弃或进入死信队列）
              defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.ACK,
              defaultRpcErrorHandler: (error, msg, amqpMsg) => {
                console.error('RPC error:', error)
                console.error('Message:', msg)
                console.error('Original message:', amqpMsg)
                throw error // 或者返回一个错误响应
              }
            }
          }
        })
      ],
      providers: [MsgPubService],
      exports: [RabbitMQModule, MsgPubService]
    }
  }
}
