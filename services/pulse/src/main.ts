import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { RedisService } from '@libs/server-redis'

import { AppModule } from './app/app.module'
import { PulseRedisIoAdapter } from './app/pulse-redis.adapter'
import { pulseRuntimeConfig } from './app/pulse-runtime.config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  })

  app.useWebSocketAdapter(new PulseRedisIoAdapter(app, app.get(RedisService), pulseRuntimeConfig))
  app.enableShutdownHooks()

  await app.listen(pulseRuntimeConfig.port)
  Logger.log(`Pulse is running on: http://localhost:${pulseRuntimeConfig.port}`)
}

bootstrap().catch(error => {
  Logger.error(`Pulse start failed: ${error}`)
  process.exit(1)
})
