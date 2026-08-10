import type { EventEnvelopeV1 } from '@libs/event-contract'

import { ServiceUnavailableException } from '@nestjs/common'

import { describe, expect, it, vi } from 'vitest'

import {
  PrismaPulseMemberAccess,
  PulseEventRegistry,
  PulseGateway,
  PulseHealthService,
  PulseMemberAccess,
  PulsePublisher,
  PulseRateStore,
  PulseReadinessProbe,
  PulseSocket,
  RedisPulseRateStore
} from './pulse-runtime.service'
import { PulseSessionVerifier } from './pulse-session.verifier'

const futureSession = {
  expiresAt: new Date('2099-01-01T00:00:00.000Z'),
  userId: 'user_01'
}

function socketStub(id = 'socket_01') {
  const rooms = new Set([id])
  const writeBuffer: unknown[] = []
  const socket = {
    id,
    conn: { writeBuffer },
    data: {},
    disconnect: vi.fn(),
    emit: vi.fn(),
    handshake: {
      address: '127.0.0.1',
      headers: { cookie: 'better-auth.session_token=opaque' }
    },
    join: vi.fn().mockImplementation(async (room: string) => {
      rooms.add(room)
    }),
    leave: vi.fn().mockImplementation(async (room: string) => {
      rooms.delete(room)
    }),
    rooms
  } as unknown as PulseSocket
  return { rooms, socket, writeBuffer }
}

function gatewayStubs(session: typeof futureSession | null = futureSession) {
  const sessions = {
    isReady: vi.fn().mockResolvedValue(true),
    verify: vi.fn().mockResolvedValue(session)
  } as unknown as PulseSessionVerifier
  const members = { isMember: vi.fn().mockResolvedValue(true) } as unknown as PulseMemberAccess
  const rateStore = { increment: vi.fn().mockResolvedValue(1) } as unknown as PulseRateStore
  const publisher = new PulsePublisher(new PulseEventRegistry())
  return { gateway: new PulseGateway(sessions, members, rateStore, publisher), members, rateStore, sessions }
}

describe('PulseGateway', () => {
  it('rejects unauthenticated and rate-limited connections', async () => {
    const unauthenticated = gatewayStubs(null)
    const first = socketStub()
    await unauthenticated.gateway.handleConnection(first.socket)
    expect(first.socket.disconnect).toHaveBeenCalledWith(true)
    expect(first.socket.emit).toHaveBeenCalledWith('pulse:error', expect.objectContaining({ code: 'UNAUTHORIZED' }))

    const limited = gatewayStubs()
    vi.mocked(limited.rateStore.increment).mockResolvedValue(31)
    const second = socketStub('socket_02')
    await limited.gateway.handleConnection(second.socket)
    expect(second.socket.emit).toHaveBeenCalledWith('pulse:error', expect.objectContaining({ code: 'RATE_LIMITED' }))
  })

  it('revalidates the session and checks membership before joining an organization room', async () => {
    const { gateway, members, sessions } = gatewayStubs()
    const { rooms, socket } = socketStub()
    await gateway.handleConnection(socket)

    await expect(gateway.subscribeOrganization(socket, { organizationId: 'org_01' })).resolves.toEqual({
      ok: true,
      room: 'organization:org_01'
    })
    expect(sessions.verify).toHaveBeenCalledTimes(2)
    expect(members.isMember).toHaveBeenCalledWith('org_01', 'user_01')
    expect(rooms).toContain('organization:org_01')

    vi.mocked(members.isMember).mockResolvedValue(false)
    await expect(gateway.subscribeOrganization(socket, { organizationId: 'org_02' })).resolves.toEqual({
      code: 'INVALID_ORGANIZATION',
      ok: false
    })
    expect(rooms).not.toContain('organization:org_02')
  })

  it('disconnects revoked sessions and slow consumers', async () => {
    const revoked = gatewayStubs()
    const revokedSocket = socketStub()
    await revoked.gateway.handleConnection(revokedSocket.socket)
    vi.mocked(revoked.sessions.verify).mockResolvedValue(null)
    await revoked.gateway.subscribeOrganization(revokedSocket.socket, { organizationId: 'org_01' })
    expect(revokedSocket.socket.disconnect).toHaveBeenCalledWith(true)

    const slow = gatewayStubs()
    const slowSocket = socketStub('socket_slow')
    slowSocket.writeBuffer.push(...Array.from({ length: 100 }, () => ({ type: 'message' })))
    const server = {
      sockets: { sockets: new Map([[slowSocket.socket.id, slowSocket.socket]]) }
    }
    Reflect.set(slow.gateway, 'server', server)
    await slow.gateway.runHeartbeatOnce()
    expect(slowSocket.socket.emit).toHaveBeenCalledWith(
      'pulse:error',
      expect.objectContaining({ code: 'SLOW_CONSUMER' })
    )
    expect(slowSocket.socket.disconnect).toHaveBeenCalledWith(true)
  })

  it('revalidates the session for every client message entry point', async () => {
    const revoked = gatewayStubs()
    const pingSocket = socketStub('socket_ping')
    await revoked.gateway.handleConnection(pingSocket.socket)
    vi.mocked(revoked.sessions.verify).mockResolvedValue(null)

    await expect(revoked.gateway.ping(pingSocket.socket)).resolves.toEqual({
      code: 'UNAUTHORIZED',
      ok: false
    })
    await expect(
      revoked.gateway.unsubscribeOrganization(pingSocket.socket, { organizationId: 'org_01' })
    ).resolves.toEqual({ code: 'UNAUTHORIZED', ok: false })
    expect(pingSocket.socket.disconnect).toHaveBeenCalledWith(true)
    expect(pingSocket.socket.emit).not.toHaveBeenCalledWith('platform:pong', expect.anything())
  })
})

describe('Pulse platform adapters', () => {
  it('uses the server-owned membership tuple', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'member_01' })
    const access = new PrismaPulseMemberAccess({ member: { findFirst } })
    await expect(access.isMember('org_01', 'user_01')).resolves.toBe(true)
    expect(findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { organizationId: 'org_01', userId: 'user_01' }
    })
  })

  it('increments the Redis rate counter atomically with its expiry', async () => {
    const evalCommand = vi.fn().mockResolvedValue(2)
    const store = new RedisPulseRateStore({ eval: evalCommand })
    await expect(store.increment('pulse:key', 60)).resolves.toBe(2)
    expect(evalCommand).toHaveBeenCalledWith(expect.stringContaining("redis.call('EXPIRE'"), 1, 'pulse:key', 60)
  })

  it('publishes only organization-scoped platform smoke envelopes', () => {
    const registry = new PulseEventRegistry()
    const publisher = new PulsePublisher(registry)
    const emit = vi.fn()
    const to = vi.fn().mockReturnValue({ emit })
    publisher.bind({ sockets: { sockets: new Map() }, to } as never)
    const envelope: EventEnvelopeV1<{ probe: true }> = {
      id: 'evt_01',
      type: 'platform.smoke',
      version: 1,
      occurredAt: '2026-08-11T00:00:00.000Z',
      correlationId: 'corr_01',
      actor: { userId: 'system:release-probe', organizationId: 'org_01' },
      payload: { probe: true }
    }

    publisher.publishPlatformSmoke('org_01', envelope)
    expect(to).toHaveBeenCalledWith('organization:org_01')
    expect(emit).toHaveBeenCalledWith('platform:event', envelope)
    expect(() => publisher.publishPlatformSmoke('org_02', envelope)).toThrow('platform.smoke@v1')
    expect(() => publisher.publishPlatformSmoke('org_01', { ...envelope, type: 'product.invented' })).toThrow(
      'platform.smoke@v1'
    )
  })

  it('fails readiness when Redis, Postgres, auth, or the contract is unavailable', async () => {
    const registry = new PulseEventRegistry()
    const healthy = new PulseReadinessProbe(registry, [
      { name: 'auth', isReady: vi.fn().mockResolvedValue(true) },
      { name: 'postgres', isReady: vi.fn().mockResolvedValue(true) },
      { name: 'redis', isReady: vi.fn().mockResolvedValue(true) }
    ])
    await expect(healthy.inspect()).resolves.toMatchObject({
      ready: true,
      eventTypes: ['platform.smoke'],
      versions: [1]
    })

    const unhealthy = new PulseReadinessProbe(registry, [
      { name: 'auth', isReady: vi.fn().mockResolvedValue(true) },
      { name: 'postgres', isReady: vi.fn().mockRejectedValue(new Error('offline')) },
      { name: 'redis', isReady: vi.fn().mockResolvedValue(true) }
    ])
    const result = await unhealthy.inspect()
    expect(result).toMatchObject({ ready: false, dependencies: { postgres: false } })
    await expect(new PulseHealthService(unhealthy).ready()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
