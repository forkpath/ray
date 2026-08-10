export const EVENT_ENVELOPE_VERSION = 1 as const

export interface EventActorV1 {
  readonly userId: string
  readonly organizationId?: string
}

export interface EventEnvelopeV1<TPayload> {
  readonly id: string
  readonly type: string
  readonly version: typeof EVENT_ENVELOPE_VERSION
  readonly occurredAt: string
  readonly correlationId: string
  readonly actor: EventActorV1
  readonly payload: TPayload
}

export interface EventEnvelopeMetadata {
  readonly id: string
  readonly type: string
  readonly version: number
}

export class InvalidEventEnvelopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidEventEnvelopeError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidEventEnvelopeError(`${field} must be a non-empty string`)
  }

  return value
}

function requireIsoTimestamp(value: unknown): string {
  const timestamp = requireNonEmptyString(value, 'occurredAt')
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new InvalidEventEnvelopeError('occurredAt must be an ISO timestamp')
  }

  return timestamp
}

export function parseEventEnvelopeMetadata(value: unknown): EventEnvelopeMetadata {
  if (!isRecord(value)) {
    throw new InvalidEventEnvelopeError('event envelope must be an object')
  }

  if (!Number.isInteger(value['version']) || Number(value['version']) < 1) {
    throw new InvalidEventEnvelopeError('version must be a positive integer')
  }

  return {
    id: requireNonEmptyString(value['id'], 'id'),
    type: requireNonEmptyString(value['type'], 'type'),
    version: Number(value['version'])
  }
}

export function parseEventEnvelopeV1<TPayload = unknown>(value: unknown): EventEnvelopeV1<TPayload> {
  const metadata = parseEventEnvelopeMetadata(value)
  if (metadata.version !== EVENT_ENVELOPE_VERSION) {
    throw new InvalidEventEnvelopeError(`unsupported event envelope version: ${metadata.version}`)
  }

  if (!isRecord(value) || !isRecord(value['actor'])) {
    throw new InvalidEventEnvelopeError('actor must be an object')
  }

  const organizationId = value['actor']['organizationId']
  if (organizationId !== undefined && (typeof organizationId !== 'string' || organizationId.trim().length === 0)) {
    throw new InvalidEventEnvelopeError('actor.organizationId must be a non-empty string when present')
  }

  if (!Object.prototype.hasOwnProperty.call(value, 'payload')) {
    throw new InvalidEventEnvelopeError('payload is required')
  }

  return {
    ...metadata,
    version: EVENT_ENVELOPE_VERSION,
    occurredAt: requireIsoTimestamp(value['occurredAt']),
    correlationId: requireNonEmptyString(value['correlationId'], 'correlationId'),
    actor: {
      userId: requireNonEmptyString(value['actor']['userId'], 'actor.userId'),
      ...(organizationId === undefined ? {} : { organizationId })
    },
    payload: value['payload'] as TPayload
  }
}
