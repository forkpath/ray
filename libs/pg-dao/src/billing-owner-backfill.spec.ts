import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL('./migrations/20260811212000_add_data_backfill_ledger/migration.sql', import.meta.url),
  'utf8'
)
const backfill = readFileSync(new URL('../scripts/backfill-billing-owners.mjs', import.meta.url), 'utf8')
const readiness = readFileSync(new URL('../scripts/check-billing-contract-readiness.mjs', import.meta.url), 'utf8')
const project = JSON.parse(readFileSync(new URL('../project.json', import.meta.url), 'utf8')) as {
  targets: Record<string, { cache?: boolean; dependsOn?: string[]; inputs?: unknown[]; options?: { command?: string } }>
}

describe('Billing owner backfill control plane', () => {
  it('adds only an additive ledger and quarantine table', () => {
    expect(migration).toContain("SET lock_timeout = '5s'")
    expect(migration).toContain('CREATE TABLE "public"."_ray_data_backfills"')
    expect(migration).toContain('CREATE TABLE "public"."_ray_data_backfill_conflicts"')
    expect(migration).not.toMatch(/\bUPDATE\s+"billing"/i)
    expect(migration).not.toMatch(/\bDELETE\s+FROM\s+"billing"/i)
    expect(migration).not.toMatch(/DROP (?:COLUMN|TABLE|CONSTRAINT)/i)
    expect(migration).not.toMatch(/VALIDATE CONSTRAINT/i)
  })

  it('requires an explicit apply mode, release provenance, and fail-fast lock', () => {
    expect(backfill).toContain('apply: false')
    expect(backfill).toContain("argument === '--apply'")
    expect(backfill).toContain('full 40-character Git commit SHA')
    expect(backfill).toContain('full sha256 OCI digest')
    expect(backfill).toContain('pg_try_advisory_lock')
    expect(backfill).toContain('_ray_data_backfill_conflicts')
    expect(backfill).toContain('Concurrent billing owner backfill cursor change')
    expect(backfill).not.toContain('POSGTRES_DATABASE_URL')
  })

  it('keeps mutating and environment-dependent commands outside Nx Cache', () => {
    expect(project.targets['billing-owner-backfill']).toMatchObject({
      cache: false,
      options: { command: 'node ./scripts/backfill-billing-owners.mjs' }
    })
    expect(project.targets['billing-contract-readiness']).toMatchObject({
      cache: false,
      options: { command: 'node ./scripts/check-billing-contract-readiness.mjs' }
    })
    expect(project.targets['test'].dependsOn).toEqual(
      expect.arrayContaining(['billing-owner-backfill-test', 'billing-contract-readiness-test'])
    )
    expect(project.targets['billing-owner-backfill-test'].inputs).toEqual(['default', '^production', { env: 'CI' }])
    expect(project.targets['billing-contract-readiness-test'].inputs).toEqual(['default', '^production', { env: 'CI' }])
  })

  it('makes Contract readiness read-only and keeps Contract DDL absent', () => {
    expect(readiness).toContain('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    expect(readiness).toContain('contractMigrationPresent: false')
    expect(readiness).toContain('v2ReadStableFor14Days')
    expect(readiness).toContain('twoSuccessfulProductionReleases')
    expect(readiness).not.toMatch(/INSERT INTO|UPDATE "|DELETE FROM/)
  })
})
