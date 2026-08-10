import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app/app.module'
import { workerRuntimeConfig } from './app/worker-runtime.config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  })
  app.enableShutdownHooks(['SIGINT', 'SIGTERM'])
  await app.listen(workerRuntimeConfig.port, '0.0.0.0')
  Logger.log(`Worker ${workerRuntimeConfig.mode} runtime is listening on ${workerRuntimeConfig.port}`)
}

bootstrap().catch(error => {
  Logger.error(`Worker start failed: ${error}`)
  process.exit(1)
})
