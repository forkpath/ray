import type { INestApplicationContext } from '@nestjs/common'
import type { ServerOptions } from 'socket.io'

import { IoAdapter } from '@nestjs/platform-socket.io'

import { createAdapter } from '@socket.io/redis-adapter'
import { Server } from 'socket.io'

import { RedisService } from '@libs/server-redis'

import { PulseRuntimeConfig } from './pulse-runtime.config'

export class PulseRedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly redis: RedisService,
    private readonly config: PulseRuntimeConfig
  ) {
    super(app)
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        credentials: true,
        origin: [...this.config.corsOrigins]
      },
      maxHttpBufferSize: this.config.maxPayloadBytes,
      pingInterval: this.config.heartbeatMs,
      pingTimeout: this.config.pingTimeoutMs,
      transports: ['websocket']
    }) as Server
    server.adapter(createAdapter(this.redis.client, this.redis.subClient))
    return server
  }
}
