import type { ThrottlerConfig } from '@libs/server-kernel'

import { DynamicModule, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ThrottlerModule as NestThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler'

import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis'

@Module({})
export class ThrottlerModule {
  static register(): DynamicModule {
    return {
      module: ThrottlerModule,
      imports: [
        NestThrottlerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const conf = configService.get<ThrottlerConfig>('throttler') as ThrottlerConfig
            const throttlerConf: ThrottlerModuleOptions = {
              throttlers: [
                {
                  name: 'default',
                  ttl: conf.ttl,
                  limit: conf.limit
                }
              ]
            }
            if (conf.storage.type === 'redis') {
              const { host, port, password, db } = conf.storage.redis
              throttlerConf.storage = new ThrottlerStorageRedisService(
                `redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`
              )
            }
            return throttlerConf
          }
        })
      ],
      exports: [NestThrottlerModule]
    }
  }
}
