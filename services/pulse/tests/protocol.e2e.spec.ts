import { randomUUID } from 'node:crypto'
import type { INestApplication } from '@nestjs/common'

import { NestFactory } from '@nestjs/core'
import { WsAdapter } from '@nestjs/platform-ws'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { auth } from '@libs/auth-server'
import { prisma } from '@libs/pg-dao'
import { PLATFORM_SMOKE_EVENT } from '@libs/platform-contract'
import { RedisService } from '@libs/server-redis'
import { createIdentity, createOrganization, responseCookie } from '@libs/testing-server'

import { AppModule } from '~/app/app.module'
import { PulseGateway } from '~/app/pulse.gateway'

import { connect } from './socket-fixture'

describe('Pulse real ws and Redis fanout', () => {
  const apps: INestApplication[] = []
  const sockets: ReturnType<typeof connect>[] = []
  const urls: string[] = []
  let cookie: string
  let userId: string
  let organizationId: string

  beforeAll(async () => {
    for (let index = 0; index < 2; index++) {
      const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false })
      apps.push(app)
      app.useWebSocketAdapter(new WsAdapter(app))
      await app.listen(0, '127.0.0.1')
      urls.push(await app.getUrl())
    }
    const user = await createIdentity()
    userId = user.id
    organizationId = (await createOrganization(user.id)).id
    // Use the real Better Auth handler to create a signed, persisted session.
    const response = await auth.handler(
      new Request(`${process.env.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: user.password })
      })
    )
    cookie = responseCookie(response)
  })
  afterEach(async () => {
    await Promise.all(sockets.splice(0).map(socket => socket.close()))
    for (const app of apps) app.get(PulseGateway).resumeTraffic()
  })
  afterAll(async () => {
    for (const app of apps.reverse()) await app.close()
    await prisma.$disconnect()
  })

  function client(index = 0, credentials = cookie) {
    const socket = connect(urls[index], credentials)
    sockets.push(socket)
    return socket
  }
  async function member(index = 0) {
    const socket = client(index)
    expect(await socket.message()).toEqual({ type: 'connected', envelopeVersions: [1] })
    socket.send({ type: 'subscribe', organizationId })
    expect(await socket.message()).toEqual({ type: 'subscribed', organizationId })
    return socket
  }

  it('rejects missing credentials and cross-organization subscriptions', async () => {
    expect(await client(0, '').closed()).toBe(4401)
    const socket = client()
    await socket.message()
    socket.send({ type: 'subscribe', organizationId: randomUUID() })
    expect(await socket.closed()).toBe(4403)
  })

  it.each(['{invalid', 'null', JSON.stringify({ type: 'subscribe', organizationId: 42 })])(
    'rejects malformed protocol input %s',
    async raw => {
      const socket = client()
      await socket.message()
      socket.socket.send(raw)
      expect(await socket.closed()).toBe(4400)
    }
  )

  it('fans out across two actual instances and survives malformed Redis input', async () => {
    const receiver = await member(1)
    const sender = await member(0)
    const redis = apps[0].get(RedisService)
    await redis.client.publish('pulse:organization-events:v1', 'null')
    const probeId = randomUUID()
    sender.send({ type: PLATFORM_SMOKE_EVENT, organizationId, payload: { probeId } })
    expect(await receiver.message()).toMatchObject({
      type: PLATFORM_SMOKE_EVENT,
      version: 1,
      actor: { userId, organizationId },
      payload: { probeId }
    })
    await sender.message()
    receiver.send({ type: 'unsubscribe', organizationId })
    expect(await receiver.message()).toEqual({ type: 'unsubscribed', organizationId })
  })

  it('closes active and new connections during drain and can resume', async () => {
    const socket = await member()
    apps[0].get(PulseGateway).beginDrain()
    expect(await socket.closed()).toBe(1012)
    expect(await client().closed()).toBe(1012)
    apps[0].get(PulseGateway).resumeTraffic()
    expect(await client().message()).toMatchObject({ type: 'connected' })
  })

  it('stops fanout after membership removal and rejects a revoked cached session', async () => {
    const receiver = await member(1)
    await prisma.member.delete({ where: { organizationId_userId: { organizationId, userId } } })
    await apps[0].get(RedisService).client.publish(
      'pulse:organization-events:v1',
      JSON.stringify({
        id: randomUUID(),
        type: PLATFORM_SMOKE_EVENT,
        version: 1,
        occurredAt: new Date().toISOString(),
        correlationId: randomUUID(),
        actor: { userId, organizationId },
        payload: { probeId: randomUUID() }
      })
    )
    expect(await receiver.closed()).toBe(4403)
    const active = client()
    await active.message()
    await prisma.session.deleteMany({ where: { userId } })
    active.send({ type: 'subscribe', organizationId })
    expect(await active.closed()).toBe(4401)
    expect(await client().closed()).toBe(4401)
  })
})
