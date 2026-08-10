import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { auth } from '@libs/auth-server'
import { PgDaoModule, PrismaService } from '@libs/pg-dao'
import { RedisModule, RedisService } from '@libs/server-redis'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import {
  PrismaPulseMemberAccess,
  PulseEventRegistry,
  PulseGateway,
  PulseHealthService,
  PulseMemberAccess,
  PulseMemberClient,
  PulsePublisher,
  PulseRateStore,
  PulseReadinessProbe,
  RedisPulseRateStore
} from './pulse-runtime.service'
import { BetterAuthPulseSessionVerifier, BetterAuthSessionApi, PulseSessionVerifier } from './pulse-session.verifier'

interface PulseReadinessPrismaClient {
  $queryRawUnsafe(query: string): Promise<unknown>
}

const pulseDependencyConfig = () => ({
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: Number(process.env['REDIS_PORT'] || 6379),
    password: process.env['REDIS_PASSWORD'] || ''
  }
})

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [pulseDependencyConfig] }),
    PgDaoModule.register(),
    RedisModule.register()
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PulseEventRegistry,
    PulsePublisher,
    PulseHealthService,
    PulseGateway,
    {
      provide: PulseSessionVerifier,
      useFactory: () => new BetterAuthPulseSessionVerifier(auth.api as unknown as BetterAuthSessionApi)
    },
    {
      provide: PulseMemberAccess,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaPulseMemberAccess(prisma as unknown as PulseMemberClient)
    },
    {
      provide: PulseRateStore,
      inject: [RedisService],
      useFactory: (redis: RedisService) => new RedisPulseRateStore(redis.client)
    },
    {
      provide: PulseReadinessProbe,
      inject: [PulseEventRegistry, PulseSessionVerifier, PrismaService, RedisService],
      useFactory: (
        registry: PulseEventRegistry,
        sessions: PulseSessionVerifier,
        prisma: PrismaService,
        redis: RedisService
      ) => {
        const database = prisma as unknown as PulseReadinessPrismaClient
        return new PulseReadinessProbe(registry, [
          { name: 'auth', isReady: () => sessions.isReady() },
          {
            name: 'postgres',
            isReady: async () => {
              await database.$queryRawUnsafe('SELECT 1')
              return true
            }
          },
          { name: 'redis', isReady: async () => (await redis.client.ping()) === 'PONG' }
        ])
      }
    }
  ]
})
export class AppModule {}
