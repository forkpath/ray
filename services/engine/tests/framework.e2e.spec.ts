import type { NestExpressApplication } from '@nestjs/platform-express'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { prisma } from '@libs/pg-dao'
import { createIdentity, createOrganization, responseCookie } from '@libs/testing-server'

import { createEngineApplication } from '~/application'

describe('Engine production HTTP assembly', () => {
  let app: NestExpressApplication
  let baseURL: string
  let adminCookie: string
  let userCookie: string
  let userId: string

  beforeAll(async () => {
    app = await createEngineApplication()
    await app.listen(0, '127.0.0.1')
    baseURL = await app.getUrl()
    for (const role of ['admin', 'user']) {
      const identity = await createIdentity(role)
      const response = await fetch(`${baseURL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identity.email, password: identity.password })
      })
      const cookie = responseCookie(response)
      if (role === 'admin') adminCookie = cookie
      else {
        userCookie = cookie
        userId = identity.id
      }
    }
  })

  afterAll(async () => {
    await app?.close()
    await prisma.$disconnect()
  })

  it('boots the complete module and applies the public prefix, envelope and headers', async () => {
    const response = await fetch(`${baseURL}/api/v1/health`)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await response.json()).toEqual({ code: 0, msg: 'ok', data: { message: 'Hello API' } })
    expect((await fetch(`${baseURL}/health`)).status).toBe(404)
  })

  it('rejects missing sessions and insufficient roles, recognizes a real admin session', async () => {
    const path = `${baseURL}/api/v1/admin/users`
    expect((await fetch(path)).status).toBe(401)
    expect((await fetch(path, { headers: { cookie: userCookie } })).status).toBe(403)
    const response = await fetch(path, { headers: { cookie: adminCookie } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ code: 0 })
  })

  it('serves the documented user and organization billing paths with the public envelope', async () => {
    const organization = await createOrganization(userId)
    for (const path of ['/api/v1/billing/me', `/api/v1/organizations/${organization.id}/billing`]) {
      const response = await fetch(`${baseURL}${path}`, { headers: { cookie: userCookie } })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ code: 0, data: [] })
    }
  })

  it('validates requests through the production Zod pipe', async () => {
    const response = await fetch(`${baseURL}/api/v1/admin/organizations/missing`, {
      method: 'PATCH',
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 42 })
    })
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toHaveProperty('msg')
    expect(body.code).not.toBe(0)
  })

  it('enforces list roles and rejects malformed or unlisted sort fields before querying', async () => {
    for (const resource of ['customers', 'organizations']) {
      const path = `${baseURL}/api/v1/admin/${resource}`
      expect((await fetch(path)).status).toBe(401)
      expect((await fetch(path, { headers: { cookie: userCookie } })).status).toBe(403)
      for (const sort of [
        JSON.stringify([{ id: 'createdAt, (select 1)' }]),
        JSON.stringify([{ id: '__proto__' }]),
        '{broken',
        '%zz'
      ]) {
        const query = new URLSearchParams({ sort })
        const response = await fetch(`${path}?${query}`, { headers: { cookie: adminCookie } })
        expect(response.status).toBe(400)
        expect(await response.json()).toHaveProperty('msg')
      }
      for (const query of ['page=0', 'perPage=0', 'perPage=101']) {
        expect((await fetch(`${path}?${query}`, { headers: { cookie: adminCookie } })).status).toBe(400)
      }
      const sort = resource === 'customers' ? 'user.name' : 'name'
      const query = new URLSearchParams({ sort: JSON.stringify([{ id: sort, desc: false }]) })
      const response = await fetch(`${path}?${query}`, { headers: { cookie: adminCookie } })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        code: 0,
        data: { list: expect.any(Array), total: expect.any(Number) }
      })
    }
  })

  it('maps an existing framework domain error without leaking infrastructure details', async () => {
    const response = await fetch(`${baseURL}/api/v1/admin/organizations/non-existent`, {
      headers: { cookie: adminCookie }
    })
    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toHaveProperty('msg')
    expect(body.code).not.toBe(0)
    expect(JSON.stringify(body)).not.toMatch(/stack|PrismaClient|password/i)
  })
})
