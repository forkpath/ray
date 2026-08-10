import { MessageHandlerErrorBehavior } from '@golevelup/nestjs-rabbitmq'
import { describe, expect, it } from 'vitest'

import { createRabbitmqConfig, parsePrefetchCount } from './rabbitmq.module'

describe('parsePrefetchCount', () => {
  it.each([
    [undefined, 5],
    ['', 5],
    ['0', 5],
    ['invalid', 5],
    ['8', 8],
    ['24', 16]
  ])('normalizes %s to %i', (value, expected) => {
    expect(parsePrefetchCount(value)).toBe(expected)
  })
})

describe('RabbitmqModule', () => {
  it('passes durable topology and disables handlers for standby runtimes', () => {
    const config = createRabbitmqConfig(
      { uri: 'amqp://localhost', exchangeName: 'core', exchangeType: 'direct' },
      {
        registerHandlers: false,
        prefetchCount: 8,
        exchanges: [{ name: 'core.dlx', type: 'direct', options: { durable: true } }],
        queues: [{ name: 'worker.dlq', options: { durable: true } }]
      }
    )

    expect(config).toMatchObject({
      registerHandlers: false,
      channels: { default: { prefetchCount: 8 } },
      defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
      exchanges: [{ name: 'core' }, { name: 'core.dlx' }],
      queues: [{ name: 'worker.dlq' }]
    })
  })
})
