import type { ServerRuntimeConfig } from './runtime-config'

import { describe, expect, it } from 'vitest'

describe('server runtime configuration contract', () => {
  it('keeps every infrastructure owner explicit', () => {
    const sections = [
      'server',
      'redis',
      'mongo',
      'cache',
      'logger',
      'i18n',
      'throttler',
      'storage',
      'sms',
      'rabbitmq',
      'elasticsearch'
    ] satisfies Array<keyof ServerRuntimeConfig>

    expect(sections).toHaveLength(11)
    expect(new Set(sections).size).toBe(sections.length)
  })
})
