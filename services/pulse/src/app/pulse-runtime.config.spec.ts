import { describe, expect, it } from 'vitest'

import { loadPulseRuntimeConfig } from './pulse-runtime.config'

describe('loadPulseRuntimeConfig', () => {
  it('uses bounded development defaults', () => {
    expect(loadPulseRuntimeConfig({ NODE_ENV: 'development' })).toMatchObject({
      connectionRateLimit: 30,
      corsOrigins: ['http://localhost:3000'],
      heartbeatMs: 20_000,
      maxBufferedPackets: 100,
      maxRoomsPerConnection: 16,
      port: 3001,
      sessionRevalidateMs: 60_000
    })
  })

  it('requires explicit trusted origins in production', () => {
    expect(() => loadPulseRuntimeConfig({ NODE_ENV: 'production' })).toThrow(
      'PULSE_CORS_ORIGINS is required in production'
    )
  })

  it('rejects invalid bounds and non-http origins', () => {
    expect(() => loadPulseRuntimeConfig({ PULSE_MAX_ROOMS_PER_CONNECTION: '0' })).toThrow(
      'PULSE_MAX_ROOMS_PER_CONNECTION'
    )
    expect(() => loadPulseRuntimeConfig({ PULSE_CORS_ORIGINS: 'file:///tmp/pulse' })).toThrow(
      'supports only http and https origins'
    )
  })
})
