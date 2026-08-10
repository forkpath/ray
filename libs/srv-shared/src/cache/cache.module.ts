import type { CacheConfig } from '@libs/server-kernel'

import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { DynamicModule, Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { createKeyv } from '@keyv/redis'

@Global()
@Module({})
export class CacheModule {
  static register(): DynamicModule {
    return {
      module: CacheModule,
      imports: [
        NestCacheModule.registerAsync({
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => {
            const { host, port, ttl, password, db } = configService.get<CacheConfig>('cache') as CacheConfig
            return {
              ttl, // milliseconds
              stores: [createKeyv(`redis://:${encodeURIComponent(password)}@${host}:${port}/${db}`)]
            }
          }
        })
      ],
      exports: [NestCacheModule]
    }
  }
}
