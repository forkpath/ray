import { describe, expect, it } from 'vitest'

import { parsePrefetchCount } from './rabbitmq.module'

describe('parsePrefetchCount', () => {
  it.each([
    [undefined, 5],
    ['', 5],
    ['0', 5],
    ['invalid', 5],
    ['8', 8],
    ['24', 16]
  ])('normalizes %s to %i', (value, expected) => {
    expect(parsePrefetchCount(value)).toBe(expected)
  })
})
