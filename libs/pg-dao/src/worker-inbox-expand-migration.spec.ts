import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./migrations/20260811230000_expand_worker_inbox/migration.sql', import.meta.url),
  'utf8'
)

describe('worker inbox expand migration', () => {
  it('is additive and does not rewrite or remove existing tables', () => {
    expect(migration).toContain("SET LOCAL lock_timeout = '5s'")
    expect(migration).toContain('CREATE TABLE "public"."worker_inbox"')
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i)
    expect(migration).not.toMatch(/ALTER\s+TABLE/i)
  })

  it('enforces the consumer and message id idempotency key', () => {
    expect(migration).toContain('"worker_inbox_consumer_message_id_key"')
    expect(migration).toContain('("consumer", "message_id")')
  })

  it('indexes retry and abandoned-claim recovery paths', () => {
    expect(migration).toContain('"worker_inbox_status_next_attempt_at_idx"')
    expect(migration).toContain('"worker_inbox_status_locked_at_idx"')
  })
})
