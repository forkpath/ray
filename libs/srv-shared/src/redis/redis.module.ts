import type { RedisConfig } from '@libs/server-kernel'

import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import Redis, { Redis as RedisClient } from 'ioredis'

import { REDIS_CLIENT, RedisService } from './redis.service'

@Global()
@Module({})
export class RedisModule {
  static register(): DynamicModule {
    const redisClientProvider: Provider = {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<RedisClient> => {
        const { host, port, password } = configService.get<RedisConfig>('redis') as RedisConfig
        return new Redis({
          host,
          port,
          password,
          // 保持连接稳定的配置
          keepAlive: 10000, // TCP keepalive 间隔（毫秒），防止空闲连接被关闭
          connectTimeout: 10000, // 连接超时时间
          enableReadyCheck: true, // 连接后检查 Redis 是否准备好
          lazyConnect: false, // 立即建立连接
          retryStrategy: (times: number) => {
            // 重连策略：最多重试 10 次，间隔逐渐增加
            if (times > 10) return null // 超过 10 次停止重试
            return Math.min(times * 200, 2000) // 最大间隔 2 秒
          }
        })
      }
    }

    return {
      module: RedisModule,
      providers: [redisClientProvider, RedisService],
      exports: [RedisService]
    }
  }
}
