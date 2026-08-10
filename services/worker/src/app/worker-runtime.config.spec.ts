import { describe, expect, it } from 'vitest'

import { loadWorkerRuntimeConfig } from './worker-runtime.config'

describe('loadWorkerRuntimeConfig', () => {
  it('defaults to an active durable platform worker topology', () => {
    expect(loadWorkerRuntimeConfig({})).toEqual({
      batchSize: 25,
      concurrency: 4,
      consumer: 'platform-worker-v1',
      deadLetterExchange: 'core.worker.dlx',
      deadLetterQueue: 'platform-worker-v1.dlq',
      deadLetterRoutingKey: 'platform-worker-v1.dead',
      exchange: 'core',
      mode: 'active',
      port: 3002,
      queue: 'platform-worker-v1',
      retryPollMs: 1_000,
      routingKey: 'platform.worker.v1'
    })
  })

  it('supports standby without accepting an invalid mode or concurrency', () => {
    expect(loadWorkerRuntimeConfig({ WORKER_RUNTIME_MODE: 'standby', WORKER_CONCURRENCY: '16' })).toMatchObject({
      mode: 'standby',
      concurrency: 16
    })
    expect(() => loadWorkerRuntimeConfig({ WORKER_RUNTIME_MODE: 'passive' })).toThrow(
      'WORKER_RUNTIME_MODE must be active or standby'
    )
    expect(() => loadWorkerRuntimeConfig({ WORKER_CONCURRENCY: '17' })).toThrow(
      'WORKER_CONCURRENCY must be an integer between 1 and 16'
    )
  })
})
