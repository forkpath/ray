export interface PulseRuntimeConfig {
  readonly connectionRateLimit: number
  readonly connectionRateWindowSeconds: number
  readonly corsOrigins: readonly string[]
  readonly drainTimeoutMs: number
  readonly heartbeatMs: number
  readonly maxBufferedPackets: number
  readonly maxPayloadBytes: number
  readonly maxRoomsPerConnection: number
  readonly pingTimeoutMs: number
  readonly port: number
  readonly sessionRevalidateMs: number
}

function parsePositiveInteger(value: string | undefined, fallback: number, field: string, maximum: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${field} must be an integer between 1 and ${maximum}`)
  }
  return parsed
}

function parseCorsOrigins(value: string | undefined, nodeEnvironment: string | undefined): readonly string[] {
  if (!value) {
    if (nodeEnvironment === 'production') {
      throw new Error('PULSE_CORS_ORIGINS is required in production')
    }
    return ['http://localhost:3000']
  }

  const origins = value
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  if (origins.length === 0) throw new Error('PULSE_CORS_ORIGINS must contain at least one origin')
  for (const origin of origins) {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('PULSE_CORS_ORIGINS supports only http and https origins')
    }
  }

  return origins
}

export function loadPulseRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): PulseRuntimeConfig {
  return {
    connectionRateLimit: parsePositiveInteger(
      environment['PULSE_CONNECTION_RATE_LIMIT'],
      30,
      'PULSE_CONNECTION_RATE_LIMIT',
      1_000
    ),
    connectionRateWindowSeconds: parsePositiveInteger(
      environment['PULSE_CONNECTION_RATE_WINDOW_SECONDS'],
      60,
      'PULSE_CONNECTION_RATE_WINDOW_SECONDS',
      3_600
    ),
    corsOrigins: parseCorsOrigins(environment['PULSE_CORS_ORIGINS'], environment['NODE_ENV']),
    drainTimeoutMs: parsePositiveInteger(
      environment['PULSE_DRAIN_TIMEOUT_MS'],
      5_000,
      'PULSE_DRAIN_TIMEOUT_MS',
      30_000
    ),
    heartbeatMs: parsePositiveInteger(environment['PULSE_HEARTBEAT_MS'], 20_000, 'PULSE_HEARTBEAT_MS', 120_000),
    maxBufferedPackets: parsePositiveInteger(
      environment['PULSE_MAX_BUFFERED_PACKETS'],
      100,
      'PULSE_MAX_BUFFERED_PACKETS',
      10_000
    ),
    maxPayloadBytes: parsePositiveInteger(
      environment['PULSE_MAX_PAYLOAD_BYTES'],
      1_048_576,
      'PULSE_MAX_PAYLOAD_BYTES',
      10_485_760
    ),
    maxRoomsPerConnection: parsePositiveInteger(
      environment['PULSE_MAX_ROOMS_PER_CONNECTION'],
      16,
      'PULSE_MAX_ROOMS_PER_CONNECTION',
      100
    ),
    pingTimeoutMs: parsePositiveInteger(environment['PULSE_PING_TIMEOUT_MS'], 20_000, 'PULSE_PING_TIMEOUT_MS', 120_000),
    port: parsePositiveInteger(environment['PULSE_PORT'] || environment['PORT'], 3001, 'PULSE_PORT', 65_535),
    sessionRevalidateMs: parsePositiveInteger(
      environment['PULSE_SESSION_REVALIDATE_MS'],
      60_000,
      'PULSE_SESSION_REVALIDATE_MS',
      900_000
    )
  }
}

export const pulseRuntimeConfig = loadPulseRuntimeConfig()
