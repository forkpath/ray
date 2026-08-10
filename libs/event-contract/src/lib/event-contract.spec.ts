import { describe, expect, it } from 'vitest'

import {
  EVENT_ENVELOPE_VERSION,
  InvalidEventEnvelopeError,
  parseEventEnvelopeMetadata,
  parseEventEnvelopeV1
} from './event-contract'

const envelope = {
  id: 'evt_01',
  type: 'platform.smoke',
  version: EVENT_ENVELOPE_VERSION,
  occurredAt: '2026-08-11T00:00:00.000Z',
  correlationId: 'corr_01',
  actor: {
    userId: 'system:release-probe',
    organizationId: 'org_01'
  },
  payload: { probe: true }
}

describe('event envelope contract', () => {
  it('parses the governed V1 envelope without changing its payload', () => {
    expect(parseEventEnvelopeV1(envelope)).toEqual(envelope)
  })

  it('extracts metadata from a future version so consumers can dead-letter it', () => {
    expect(parseEventEnvelopeMetadata({ ...envelope, version: 2 })).toEqual({
      id: 'evt_01',
      type: 'platform.smoke',
      version: 2
    })
  })

  it.each([
    [{ ...envelope, occurredAt: 'not-a-date' }, 'occurredAt must be an ISO timestamp'],
    [{ ...envelope, actor: {} }, 'actor.userId must be a non-empty string'],
    [{ ...envelope, version: 0 }, 'version must be a positive integer']
  ])('rejects an invalid envelope %#', (candidate, expectedMessage) => {
    expect(() => parseEventEnvelopeV1(candidate)).toThrowError(new InvalidEventEnvelopeError(expectedMessage))
  })

  it('retains an explicitly undefined payload', () => {
    expect(parseEventEnvelopeV1({ ...envelope, payload: undefined })).toMatchObject({ payload: undefined })
  })

  it('rejects a missing payload property', () => {
    const candidate: Record<string, unknown> = { ...envelope }
    delete candidate.payload
    expect(() => parseEventEnvelopeV1(candidate)).toThrow('payload is required')
  })
})
