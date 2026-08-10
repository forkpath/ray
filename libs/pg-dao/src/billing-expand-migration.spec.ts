import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const structureMigration = readFileSync(
  new URL('./migrations/20260811090000_expand_billing_owner_and_webhook/migration.sql', import.meta.url),
  'utf8'
)
const indexMigration = readFileSync(
  new URL('./online-migrations/20260811090100_expand_billing_indexes.sql', import.meta.url),
  'utf8'
)
const onlineMigrationRunner = readFileSync(new URL('../scripts/run-online-migrations.mjs', import.meta.url), 'utf8')
const projectConfiguration = JSON.parse(readFileSync(new URL('../project.json', import.meta.url), 'utf8')) as {
  targets: Record<string, { cache?: boolean; options?: { command?: string } }>
}

describe('Billing owner and webhook Expand migrations', () => {
  it('adds nullable owner columns and NOT VALID foreign keys with a bounded lock wait', () => {
    expect(structureMigration).toContain("SET lock_timeout = '5s'")
    expect(structureMigration).toMatch(/ADD COLUMN IF NOT EXISTS "user_id" TEXT/)
    expect(structureMigration).toMatch(/ADD COLUMN IF NOT EXISTS "organization_id" TEXT/)
    expect(structureMigration.match(/NOT VALID/g)).toHaveLength(2)
    expect(structureMigration).toContain('customer_user_id_fkey')
    expect(structureMigration).toContain('customer_organization_id_fkey')
  })

  it('expands webhook claim state without removing the legacy processed-at default', () => {
    expect(structureMigration).toContain("ADD VALUE IF NOT EXISTS 'received'")
    expect(structureMigration).toContain("ADD VALUE IF NOT EXISTS 'processing'")
    expect(structureMigration).toMatch(/"received_at" TIMESTAMP\(3\) NOT NULL DEFAULT CURRENT_TIMESTAMP/)
    expect(structureMigration).toMatch(/"last_attempt_at" TIMESTAMP\(3\)/)
    expect(structureMigration).toMatch(/"attempt_count" INTEGER NOT NULL DEFAULT 0/)
    expect(structureMigration).toMatch(/ALTER COLUMN "processed_at" DROP NOT NULL/)
    expect(structureMigration).not.toMatch(/ALTER COLUMN "processed_at" DROP DEFAULT/)
  })

  it('contains no backfill, validation, Contract constraint, or legacy-column removal', () => {
    expect(structureMigration).not.toMatch(/\bUPDATE\s+"billing"/i)
    expect(structureMigration).not.toMatch(/VALIDATE CONSTRAINT/i)
    expect(structureMigration).not.toMatch(/SET NOT NULL/i)
    expect(structureMigration).not.toMatch(/DROP COLUMN/i)
    expect(structureMigration).not.toMatch(/DROP CONSTRAINT/i)
  })

  it('builds every new index concurrently outside an explicit transaction', () => {
    const createIndexStatements = indexMigration.match(/^CREATE (?:UNIQUE )?INDEX[^;]+;/gm) ?? []

    expect(createIndexStatements).toHaveLength(8)
    expect(createIndexStatements.every(statement => statement.includes('CONCURRENTLY'))).toBe(true)
    expect(indexMigration).not.toMatch(/^\s*(BEGIN|COMMIT);\s*$/m)
    expect(indexMigration).toContain("SET lock_timeout = '5s'")
    expect(indexMigration.match(/-- statement-breakpoint/g)).toHaveLength(12)
  })

  it('uses partial owner uniqueness and fails closed on duplicates or invalid retry state', () => {
    expect(indexMigration).toMatch(
      /UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "customer_user_id_provider_key_v2"[\s\S]+WHERE "user_id" IS NOT NULL/
    )
    expect(indexMigration).toMatch(
      /UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "customer_organization_id_provider_key_v2"[\s\S]+WHERE "organization_id" IS NOT NULL/
    )
    expect(indexMigration).toContain('AND NOT index_state.indisvalid')
    expect(indexMigration).toContain('HAVING COUNT(*) > 1')
    expect(indexMigration).toContain('review permissions before retrying')
  })

  it('runs online migrations once under an advisory lock and outside Nx Cache', () => {
    expect(onlineMigrationRunner).toContain('pg_advisory_lock')
    expect(onlineMigrationRunner).toContain('_ray_online_migrations')
    expect(onlineMigrationRunner).toContain('checksum mismatch')
    expect(onlineMigrationRunner).toContain('conflict-report')
    expect(onlineMigrationRunner).toContain('duplicateOrganizationRoles')
    expect(onlineMigrationRunner).toContain('no index was created')
    expect(onlineMigrationRunner).toContain('POSTGRES_DATABASE_URL is required')
    expect(onlineMigrationRunner).not.toContain('POSGTRES_DATABASE_URL')
    expect(projectConfiguration.targets['online-migrate']).toMatchObject({
      cache: false,
      options: { command: 'node ./scripts/run-online-migrations.mjs' }
    })
  })
})
