import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(
  new URL('./migrations/20260810174000_expand_two_factor_lockout/migration.sql', import.meta.url),
  'utf8'
)
const verifiedMigrationSql = readFileSync(
  new URL('./migrations/20260811083000_expand_two_factor_verified/migration.sql', import.meta.url),
  'utf8'
)

describe('Better Auth two-factor Expand migration', () => {
  it('adds the 1.6.22 lockout columns with a bounded lock wait', () => {
    expect(migrationSql).toContain("SET LOCAL lock_timeout = '5s'")
    expect(migrationSql).toMatch(/ADD COLUMN "failed_verification_count" INTEGER DEFAULT 0/)
    expect(migrationSql).toMatch(/ADD COLUMN "locked_until" TIMESTAMP\(3\)/)
  })

  it('contains no Contract or data-rewrite operation', () => {
    expect(migrationSql).not.toMatch(/\b(DROP|DELETE|UPDATE|RENAME|SET\s+NOT\s+NULL)\b/i)
  })

  it('adds the governed nullable verified field without a rewrite or Contract operation', () => {
    expect(verifiedMigrationSql).toContain("SET LOCAL lock_timeout = '5s'")
    expect(verifiedMigrationSql).toMatch(/ADD COLUMN "verified" BOOLEAN DEFAULT true/)
    expect(verifiedMigrationSql).not.toMatch(/\b(DROP|DELETE|UPDATE|RENAME|SET\s+NOT\s+NULL)\b/i)
  })
})
