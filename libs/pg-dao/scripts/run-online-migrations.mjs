import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import pg from 'pg'

const { Client } = pg

const migrationFiles = ['20260811090100_expand_billing_indexes.sql']
const statementBreakpoint = '-- statement-breakpoint'
const advisoryLockName = 'ray:pg-dao:online-migrations'
const billingExpandMigrationId = '20260811090100_expand_billing_indexes'
const billingExpandIndexNames = [
  'customer_user_id_provider_key_v2',
  'customer_organization_id_provider_key_v2',
  'subscription_customer_id_status_created_at_idx',
  'order_customer_id_status_created_at_idx',
  'member_organization_id_user_id_key',
  'organization_role_organization_id_role_key',
  'invitation_organization_id_status_idx',
  'invitation_email_status_idx'
]

function requireDatabaseUrl() {
  const databaseUrl = process.env.POSTGRES_DATABASE_URL
  if (!databaseUrl) {
    throw new Error('POSTGRES_DATABASE_URL is required for online migrations')
  }
  return databaseUrl
}

function checksum(contents) {
  return createHash('sha256').update(contents).digest('hex')
}

function splitStatements(contents) {
  const statements = contents
    .split(statementBreakpoint)
    .map(statement => statement.trim())
    .filter(Boolean)

  for (const statement of statements) {
    if (/^\s*(BEGIN|COMMIT|ROLLBACK);\s*$/im.test(statement)) {
      throw new Error('Online migrations must not contain an explicit transaction block')
    }
  }

  return statements
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "public"."_ray_online_migrations" (
      "id" TEXT PRIMARY KEY,
      "checksum" TEXT NOT NULL,
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

async function assertBillingExpandPreflight(client) {
  const [duplicateMembers, duplicateOrganizationRoles, invalidIndexes] = await Promise.all([
    client.query(`
      SELECT
        "organization_id" AS "organizationId",
        "user_id" AS "userId",
        json_agg(
          json_build_object('id', "id", 'role', "role", 'createdAt', "created_at")
          ORDER BY "created_at", "id"
        ) AS "records"
      FROM "public"."member"
      GROUP BY "organization_id", "user_id"
      HAVING COUNT(*) > 1
    `),
    client.query(`
      SELECT
        "organization_id" AS "organizationId",
        "role",
        json_agg(
          json_build_object(
            'id', "id",
            'permission', "permission",
            'createdAt', "created_at",
            'updatedAt', "updated_at"
          )
          ORDER BY "created_at", "id"
        ) AS "records"
      FROM "public"."organization_role"
      GROUP BY "organization_id", "role"
      HAVING COUNT(*) > 1
    `),
    client.query(
      `
        SELECT
          index_namespace.nspname AS "schema",
          index_relation.relname AS "index"
        FROM pg_index index_state
        JOIN pg_class index_relation ON index_relation.oid = index_state.indexrelid
        JOIN pg_namespace index_namespace ON index_namespace.oid = index_relation.relnamespace
        WHERE index_relation.relname = ANY($1::text[])
          AND NOT index_state.indisvalid
        ORDER BY index_namespace.nspname, index_relation.relname
      `,
      [billingExpandIndexNames]
    )
  ])
  const conflictReport = {
    migrationId: billingExpandMigrationId,
    duplicateMembers: duplicateMembers.rows,
    duplicateOrganizationRoles: duplicateOrganizationRoles.rows,
    invalidIndexes: invalidIndexes.rows
  }
  const conflictCount =
    conflictReport.duplicateMembers.length +
    conflictReport.duplicateOrganizationRoles.length +
    conflictReport.invalidIndexes.length

  if (conflictCount === 0) {
    return
  }

  console.error(`[online-migrate] conflict-report: ${JSON.stringify(conflictReport)}`)
  throw new Error(`Wave 4 Expand preflight found ${conflictCount} conflict group(s); no index was created`)
}

async function applyMigration(client, migrationFile) {
  const migrationUrl = new URL(`../src/online-migrations/${migrationFile}`, import.meta.url)
  const contents = await readFile(migrationUrl, 'utf8')
  const migrationChecksum = checksum(contents)
  const migrationId = migrationFile.replace(/\.sql$/, '')
  const existing = await client.query('SELECT "checksum" FROM "public"."_ray_online_migrations" WHERE "id" = $1', [
    migrationId
  ])

  if (existing.rowCount === 1) {
    if (existing.rows[0].checksum !== migrationChecksum) {
      throw new Error(`Online migration checksum mismatch: ${migrationId}`)
    }
    console.log(`[online-migrate] already applied: ${migrationId}`)
    return
  }

  if (migrationId === billingExpandMigrationId) {
    await assertBillingExpandPreflight(client)
  }

  const statements = splitStatements(contents)
  for (const statement of statements) {
    await client.query(statement)
  }

  await client.query('INSERT INTO "public"."_ray_online_migrations" ("id", "checksum") VALUES ($1, $2)', [
    migrationId,
    migrationChecksum
  ])
  console.log(`[online-migrate] applied: ${migrationId} (${statements.length} statements)`)
}

async function main() {
  const client = new Client({ connectionString: requireDatabaseUrl() })
  await client.connect()

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [advisoryLockName])
    await ensureLedger(client)
    for (const migrationFile of migrationFiles) {
      await applyMigration(client, migrationFile)
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [advisoryLockName]).catch(() => undefined)
    await client.end()
  }
}

main().catch(error => {
  console.error(`[online-migrate] failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
