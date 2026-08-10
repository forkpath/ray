import type { RabbitmqConfig } from '@libs/server-kernel'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AmqpConnection } from '@golevelup/nestjs-rabbitmq'

@Injectable()
export class MsgPubService {
  exchange = 'core_exchange'

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigService
  ) {
    const rabbitConfig = this.configService.get<RabbitmqConfig>('rabbitmq') as RabbitmqConfig
    this.exchange = rabbitConfig.exchangeName
  }

  async publish(routingKeystring: string, msg: unknown): Promise<void> {
    const routingKey = routingKeystring.replace(/_/g, '.')
    await this.amqpConnection.publish(this.exchange, routingKey, msg)
  }
}
