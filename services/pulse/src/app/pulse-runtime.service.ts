import { createHash } from 'node:crypto'
import type { OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common'
import type { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets'
import type { EventEnvelopeV1 } from '@libs/event-contract'
import type { IncomingHttpHeaders } from 'node:http'
import type { Server, Socket } from 'socket.io'

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'

import { EVENT_ENVELOPE_VERSION, parseEventEnvelopeV1 } from '@libs/event-contract'

import { pulseRuntimeConfig } from './pulse-runtime.config'
import { PulseSession, PulseSessionVerifier } from './pulse-session.verifier'

export interface PulseErrorPayload {
  readonly code:
    | 'DRAINING'
    | 'INVALID_ORGANIZATION'
    | 'RATE_LIMITED'
    | 'ROOM_LIMIT_EXCEEDED'
    | 'SLOW_CONSUMER'
    | 'UNAUTHORIZED'
    | 'UNSUPPORTED_EVENT'
  readonly message: string
}

export interface PulseAck {
  readonly ok: boolean
  readonly code?: PulseErrorPayload['code']
  readonly room?: string
}

interface ClientToServerEvents {
  'organization:subscribe': (payload: unknown) => void
  'organization:unsubscribe': (payload: unknown) => void
  'platform:ping': () => void
}

interface ServerToClientEvents {
  'organization:subscribed': (payload: { organizationId: string }) => void
  'organization:unsubscribed': (payload: { organizationId: string }) => void
  'platform:draining': (payload: { reconnect: boolean }) => void
  'platform:event': (payload: EventEnvelopeV1<unknown>) => void
  'platform:heartbeat': (payload: { occurredAt: string; version: 1 }) => void
  'platform:pong': (payload: { occurredAt: string }) => void
  'pulse:error': (payload: PulseErrorPayload) => void
}

interface PulseSocketData {
  expiryTimer?: ReturnType<typeof setTimeout>
  lastValidatedAt?: number
  session?: PulseSession
}

export type PulseSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, PulseSocketData>
export type PulseServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, PulseSocketData>

export interface PulseMemberClient {
  member: {
    findFirst(input: {
      select: { id: true }
      where: { organizationId: string; userId: string }
    }): Promise<{ id: string } | null>
  }
}

export abstract class PulseMemberAccess {
  abstract isMember(organizationId: string, userId: string): Promise<boolean>
}

export class PrismaPulseMemberAccess extends PulseMemberAccess {
  constructor(private readonly client: PulseMemberClient) {
    super()
  }

  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const member = await this.client.member.findFirst({
      where: { organizationId, userId },
      select: { id: true }
    })
    return member !== null
  }
}

export interface PulseRateClient {
  eval(script: string, keyCount: number, key: string, windowSeconds: number): Promise<unknown>
}

export abstract class PulseRateStore {
  abstract increment(key: string, windowSeconds: number): Promise<number>
}

export class RedisPulseRateStore extends PulseRateStore {
  constructor(private readonly client: PulseRateClient) {
    super()
  }

  async increment(key: string, windowSeconds: number): Promise<number> {
    const result = await this.client.eval(
      "local current = redis.call('INCR', KEYS[1]); if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return current",
      1,
      key,
      windowSeconds
    )
    const count = Number(result)
    if (!Number.isInteger(count) || count < 1) throw new Error('Redis returned an invalid rate counter')
    return count
  }
}

@Injectable()
export class PulseEventRegistry {
  readonly eventTypes = ['platform.smoke'] as const
  readonly versions = [EVENT_ENVELOPE_VERSION] as const

  supports(type: string, version: number): boolean {
    return type === 'platform.smoke' && version === EVENT_ENVELOPE_VERSION
  }
}

@Injectable()
export class PulsePublisher {
  private server?: PulseServer

  constructor(private readonly registry: PulseEventRegistry) {}

  bind(server: PulseServer): void {
    this.server = server
  }

  publishPlatformSmoke(organizationId: string, candidate: unknown): void {
    const envelope = parseEventEnvelopeV1(candidate)
    if (!this.registry.supports(envelope.type, envelope.version) || envelope.actor.organizationId !== organizationId) {
      throw new Error('Pulse accepts only organization-scoped platform.smoke@v1 events')
    }
    if (!this.server) throw new Error('Pulse publisher is not bound to a WebSocket server')

    const room = organizationRoom(organizationId)
    for (const socket of this.server.sockets.sockets.values()) {
      if (socket.rooms.has(room) && bufferedPacketCount(socket) >= pulseRuntimeConfig.maxBufferedPackets) {
        socket.emit('pulse:error', { code: 'SLOW_CONSUMER', message: 'Outbound buffer limit exceeded' })
        socket.disconnect(true)
      }
    }
    this.server.to(room).emit('platform:event', envelope)
  }
}

export interface PulseReadinessDependency {
  readonly isReady: () => Promise<boolean>
  readonly name: 'auth' | 'postgres' | 'redis'
}

export interface PulseReadiness {
  readonly dependencies: Record<string, boolean>
  readonly eventTypes: readonly string[]
  readonly ready: boolean
  readonly versions: readonly number[]
}

export class PulseReadinessProbe {
  constructor(
    private readonly registry: PulseEventRegistry,
    private readonly dependencies: readonly PulseReadinessDependency[]
  ) {}

  async inspect(): Promise<PulseReadiness> {
    const checks = await Promise.all(
      this.dependencies.map(async dependency => {
        try {
          return [dependency.name, await dependency.isReady()] as const
        } catch {
          return [dependency.name, false] as const
        }
      })
    )
    const dependencies = Object.fromEntries(checks)
    const contractReady = this.registry.supports('platform.smoke', EVENT_ENVELOPE_VERSION)
    return {
      ready: contractReady && Object.values(dependencies).every(Boolean),
      dependencies,
      eventTypes: this.registry.eventTypes,
      versions: this.registry.versions
    }
  }
}

@Injectable()
export class PulseHealthService {
  constructor(private readonly readiness: PulseReadinessProbe) {}

  live(): { service: 'pulse'; status: 'ok' } {
    return { service: 'pulse', status: 'ok' }
  }

  async ready(): Promise<PulseReadiness> {
    const result = await this.readiness.inspect()
    if (!result.ready) throw new ServiceUnavailableException(result)
    return result
  }
}

function organizationIdFrom(payload: unknown): string | null {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null
  const organizationId = (payload as Record<string, unknown>)['organizationId']
  if (typeof organizationId !== 'string') return null
  const normalized = organizationId.trim()
  return normalized.length > 0 && normalized.length <= 255 ? normalized : null
}

export function organizationRoom(organizationId: string): string {
  return `organization:${organizationId}`
}

function bufferedPacketCount(client: PulseSocket): number {
  const connection = client.conn as unknown as { readonly writeBuffer?: readonly unknown[] }
  return connection.writeBuffer?.length ?? 0
}

function clientAddress(client: PulseSocket): string {
  const forwarded = client.handshake.headers['x-forwarded-for']
  const address = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]
  return address?.trim() || client.handshake.address || 'unknown'
}

function rateKey(client: PulseSocket, now: number): string {
  const addressHash = createHash('sha256').update(clientAddress(client)).digest('hex')
  const window = Math.floor(now / (pulseRuntimeConfig.connectionRateWindowSeconds * 1_000))
  return `pulse:connection-rate:${addressHash}:${window}`
}

@WebSocketGateway({ path: '/pulse/socket.io', transports: ['websocket'] })
export class PulseGateway
  implements
    OnGatewayConnection<PulseSocket>,
    OnGatewayDisconnect<PulseSocket>,
    OnGatewayInit<PulseServer>,
    OnApplicationShutdown,
    OnModuleDestroy
{
  @WebSocketServer()
  private server?: PulseServer

  private readonly logger = new Logger(PulseGateway.name)
  private draining = false
  private heartbeatTimer?: ReturnType<typeof setInterval>

  constructor(
    private readonly sessions: PulseSessionVerifier,
    private readonly members: PulseMemberAccess,
    private readonly rateStore: PulseRateStore,
    private readonly publisher: PulsePublisher
  ) {}

  afterInit(server: PulseServer): void {
    this.server = server
    this.publisher.bind(server)
    this.heartbeatTimer = setInterval(() => void this.runHeartbeatOnce(), pulseRuntimeConfig.heartbeatMs)
    this.heartbeatTimer.unref()
  }

  async handleConnection(client: PulseSocket): Promise<void> {
    if (this.draining) {
      this.reject(client, 'DRAINING', 'Pulse is draining for deployment')
      return
    }

    try {
      const count = await this.rateStore.increment(
        rateKey(client, Date.now()),
        pulseRuntimeConfig.connectionRateWindowSeconds
      )
      if (count > pulseRuntimeConfig.connectionRateLimit) {
        this.reject(client, 'RATE_LIMITED', 'Connection rate limit exceeded')
        return
      }
      if (!(await this.authorize(client, true))) return
      const userId = client.data.session?.userId
      if (!userId) {
        this.reject(client, 'UNAUTHORIZED', 'A valid session is required')
        return
      }
      await client.join(`user:${userId}`)
    } catch (error) {
      this.logger.warn(`Pulse connection rejected: ${error instanceof Error ? error.message : 'unknown error'}`)
      this.reject(client, 'UNAUTHORIZED', 'Session verification failed')
    }
  }

  handleDisconnect(client: PulseSocket): void {
    if (client.data.expiryTimer) clearTimeout(client.data.expiryTimer)
  }

  @SubscribeMessage('organization:subscribe')
  async subscribeOrganization(
    @ConnectedSocket() client: PulseSocket,
    @MessageBody() payload: unknown
  ): Promise<PulseAck> {
    const organizationId = organizationIdFrom(payload)
    if (!organizationId) return this.rejectAck(client, 'INVALID_ORGANIZATION', 'organizationId is required')
    if (!(await this.authorize(client, true))) return { ok: false, code: 'UNAUTHORIZED' }

    const organizationRooms = [...client.rooms].filter(room => room.startsWith('organization:'))
    if (
      !client.rooms.has(organizationRoom(organizationId)) &&
      organizationRooms.length >= pulseRuntimeConfig.maxRoomsPerConnection
    ) {
      return this.rejectAck(client, 'ROOM_LIMIT_EXCEEDED', 'Organization room limit exceeded')
    }

    const userId = client.data.session?.userId
    if (!userId || !(await this.members.isMember(organizationId, userId))) {
      return this.rejectAck(client, 'INVALID_ORGANIZATION', 'Organization membership is required')
    }

    const room = organizationRoom(organizationId)
    await client.join(room)
    client.emit('organization:subscribed', { organizationId })
    return { ok: true, room }
  }

  @SubscribeMessage('organization:unsubscribe')
  async unsubscribeOrganization(
    @ConnectedSocket() client: PulseSocket,
    @MessageBody() payload: unknown
  ): Promise<PulseAck> {
    const organizationId = organizationIdFrom(payload)
    if (!organizationId) return this.rejectAck(client, 'INVALID_ORGANIZATION', 'organizationId is required')
    if (!(await this.authorize(client, true))) return { ok: false, code: 'UNAUTHORIZED' }
    const room = organizationRoom(organizationId)
    await client.leave(room)
    client.emit('organization:unsubscribed', { organizationId })
    return { ok: true, room }
  }

  @SubscribeMessage('platform:ping')
  async ping(@ConnectedSocket() client: PulseSocket): Promise<PulseAck> {
    if (!(await this.authorize(client, true))) return { ok: false, code: 'UNAUTHORIZED' }
    client.emit('platform:pong', { occurredAt: new Date().toISOString() })
    return { ok: true }
  }

  async runHeartbeatOnce(): Promise<void> {
    if (!this.server) return
    await Promise.allSettled(
      [...this.server.sockets.sockets.values()].map(async client => {
        if (bufferedPacketCount(client) >= pulseRuntimeConfig.maxBufferedPackets) {
          this.reject(client, 'SLOW_CONSUMER', 'Outbound buffer limit exceeded')
          return
        }
        if (!(await this.authorize(client, false))) return
        client.emit('platform:heartbeat', {
          occurredAt: new Date().toISOString(),
          version: EVENT_ENVELOPE_VERSION
        })
      })
    )
  }

  async onApplicationShutdown(): Promise<void> {
    await this.drain()
  }

  async onModuleDestroy(): Promise<void> {
    await this.drain()
  }

  async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (!this.server) return

    this.server.emit('platform:draining', { reconnect: true })
    await new Promise(resolve => setTimeout(resolve, pulseRuntimeConfig.drainTimeoutMs))
    this.server.disconnectSockets(true)
  }

  private async authorize(client: PulseSocket, force: boolean): Promise<boolean> {
    const now = Date.now()
    const current = client.data.session
    const recentlyValidated =
      current &&
      client.data.lastValidatedAt &&
      now - client.data.lastValidatedAt < pulseRuntimeConfig.sessionRevalidateMs
    if (!force && recentlyValidated && current.expiresAt.getTime() > now) return true

    let session: PulseSession | null
    try {
      session = await this.sessions.verify(client.handshake.headers as IncomingHttpHeaders)
    } catch (error) {
      this.logger.warn(`Pulse session verification failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      this.reject(client, 'UNAUTHORIZED', 'Session verification failed')
      return false
    }
    if (!session || session.expiresAt.getTime() <= now || (current && current.userId !== session.userId)) {
      this.reject(client, 'UNAUTHORIZED', 'A valid session is required')
      return false
    }

    client.data.session = session
    client.data.lastValidatedAt = now
    this.scheduleExpiration(client, session)
    return true
  }

  private scheduleExpiration(client: PulseSocket, session: PulseSession): void {
    if (client.data.expiryTimer) clearTimeout(client.data.expiryTimer)
    const remaining = session.expiresAt.getTime() - Date.now()
    if (remaining <= 0 || remaining > 2_147_000_000) return
    client.data.expiryTimer = setTimeout(() => this.reject(client, 'UNAUTHORIZED', 'Session expired'), remaining)
    client.data.expiryTimer.unref()
  }

  private reject(client: PulseSocket, code: PulseErrorPayload['code'], message: string): void {
    client.emit('pulse:error', { code, message })
    client.disconnect(true)
  }

  private rejectAck(client: PulseSocket, code: PulseErrorPayload['code'], message: string): PulseAck {
    client.emit('pulse:error', { code, message })
    return { ok: false, code }
  }
}
