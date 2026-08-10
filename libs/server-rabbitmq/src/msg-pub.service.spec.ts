import type { ConfigService } from '@nestjs/config'
import type { AmqpConnection } from '@golevelup/nestjs-rabbitmq'

import { describe, expect, it, vi } from 'vitest'

import { MsgPubService } from './msg-pub.service'

describe('MsgPubService', () => {
  it('publishes through the configured exchange with a normalized routing key', async () => {
    const publish = vi.fn().mockResolvedValue(undefined)
    const get = vi.fn().mockReturnValue({ exchangeName: 'events' })
    const service = new MsgPubService({ publish } as unknown as AmqpConnection, { get } as unknown as ConfigService)

    await service.publish('billing_customer_created', { customerId: 'customer-1' })

    expect(get).toHaveBeenCalledWith('rabbitmq')
    expect(publish).toHaveBeenCalledWith('events', 'billing.customer.created', {
      customerId: 'customer-1'
    })
  })
})
