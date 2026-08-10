import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'

import { createApiClient } from './client'
import { ApiError, ApiNetworkError } from './errors'

function makeResponse(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    headers: {},
    config
  }
}

function createAdapter(
  handler: (config: InternalAxiosRequestConfig) => AxiosResponse | Promise<AxiosResponse>
): AxiosAdapter {
  return async config => handler(config)
}

describe('createApiClient', () => {
  it('unwraps wrapped response when code is 0', async () => {
    const api = createApiClient({
      baseURL: '',
      adapter: createAdapter(config => makeResponse(config, { code: 0, msg: 'ok', data: { ok: true } }))
    })

    const result = await api.get('/users')
    expect(result).toEqual({ ok: true })
  })

  it('throws ApiError when wrapped response code is not 0', async () => {
    const api = createApiClient({
      baseURL: '',
      adapter: createAdapter(config => makeResponse(config, { code: 1001, msg: 'bad', data: null }))
    })

    await expect(api.get('/users')).rejects.toBeInstanceOf(ApiError)
    await expect(api.get('/users')).rejects.toMatchObject({ code: 1001 })
  })

  it('returns raw data for authBasePath requests', async () => {
    const api = createApiClient({
      baseURL: '',
      adapter: createAdapter(config => makeResponse(config, { session: 'ok' })),
      authBasePath: '/api/auth'
    })

    const result = await api.get('/api/auth/session')
    expect(result).toEqual({ session: 'ok' })
  })

  it('returns raw data when skipWrap is true', async () => {
    const api = createApiClient({
      baseURL: '',
      adapter: createAdapter(config => makeResponse(config, { ok: true }))
    })

    const result = await api.get('/external', { api: { skipWrap: true } })
    expect(result).toEqual({ ok: true })
  })

  it('returns AxiosResponse when raw is true', async () => {
    const api = createApiClient({
      baseURL: '',
      adapter: createAdapter(config => makeResponse(config, { code: 0, msg: 'ok', data: 1 }))
    })

    const response = await api.get('/users', { api: { raw: true } })
    expect(response.status).toBe(200)
    expect(response.data).toEqual({ code: 0, msg: 'ok', data: 1 })
  })

  it('injects auth header when token is available', async () => {
    const api = createApiClient({
      baseURL: '',
      auth: {
        getAccessToken: () => 'token'
      },
      adapter: createAdapter(config => {
        return makeResponse(config, { code: 0, msg: 'ok', data: config.headers.get('Authorization') })
      })
    })

    const result = await api.get('/users')
    expect(result).toBe('Bearer token')
  })

  it('throws ApiNetworkError when request has no response', async () => {
    const api = createApiClient({
      baseURL: '',
      adapter: async config => {
        throw new AxiosError('Network Error', 'ERR_NETWORK', config)
      }
    })

    await expect(api.get('/users')).rejects.toBeInstanceOf(ApiNetworkError)
  })

  it('wraps non-standard error responses into ApiError', async () => {
    const api = createApiClient({
      baseURL: '',
      adapter: async config => {
        const response = makeResponse(config, { message: 'boom' }, 500)
        throw new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, undefined, response)
      }
    })

    await expect(api.get('/users')).rejects.toBeInstanceOf(ApiError)
    await expect(api.get('/users')).rejects.toMatchObject({ status: 500 })
  })

  it('wraps wrapped error responses into ApiError with code', async () => {
    const api = createApiClient({
      baseURL: '',
      adapter: async config => {
        const response = makeResponse(config, { code: 4001, msg: 'invalid', data: null }, 400)
        throw new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, undefined, response)
      }
    })

    await expect(api.get('/users')).rejects.toBeInstanceOf(ApiError)
    await expect(api.get('/users')).rejects.toMatchObject({ code: 4001 })
  })
})
