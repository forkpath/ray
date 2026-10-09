// Test-only entry point: the complete production module with a controllable
// handler for crash/restart verification. Never included by tsconfig.app.json.
import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { PLATFORM_SMOKE_EVENT } from '@libs/platform-contract'
import { assertIsolatedTestEnvironment } from '@libs/testing-server'

import { AppModule } from '~/app/app.module'
import { PlatformHandlerRegistry } from '~/app/platform-handler.registry'

async function start() {
  assertIsolatedTestEnvironment()
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false })
  if (process.env.RAY_TEST_CRASH_HANDLER === 'true') {
    app.get(PlatformHandlerRegistry).register(PLATFORM_SMOKE_EVENT, 1, async envelope => {
      process.send?.({ type: 'handling', id: envelope.id })
      await new Promise<void>(() => {
        /* parent deliberately kills this process */
      })
    })
  }
  await app.listen(0, '127.0.0.1')
  process.on(
    'SIGTERM',
    () =>
      void app.close().then(
        () => process.exit(0),
        () => process.exit(1)
      )
  )
  process.send?.({ type: 'ready', url: await app.getUrl() })
}

start().catch(error => {
  console.error(error)
  process.exit(1)
})
