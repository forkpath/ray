import { pathToFileURL } from 'node:url'

import pg from 'pg'

const { Client } = pg

export const billingOwnerBackfillId = 'billing-owner-v2-user-backfill'
const advisoryLockName = `ray:pg-dao:${billingOwnerBackfillId}`

function positiveInteger(value, option) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} must be a positive integer`)
  }
  return parsed
}

export function parseBackfillOptions(argv) {
  const options = { apply: false, batchSize: 250, maxBatches: Number.POSITIVE_INFINITY }

  for (const argument of argv) {
    if (argument === '--apply') options.apply = true
    else if (argument.startsWith('--batch-size='))
      options.batchSize = positiveInteger(argument.split('=')[1], '--batch-size')
    else if (argument.startsWith('--max-batches='))
      options.maxBatches = positiveInteger(argument.split('=')[1], '--max-batches')
    else if (argument.startsWith('--git-sha=')) options.gitSha = argument.slice('--git-sha='.length)
    else if (argument.startsWith('--image-digest=')) options.imageDigest = argument.slice('--image-digest='.length)
    else if (argument.startsWith('--operator=')) options.operator = argument.slice('--operator='.length)
    else throw new Error(`Unknown option: ${argument}`)
  }

  if (options.apply && (!options.gitSha || !options.imageDigest || !options.operator)) {
    throw new Error('--apply requires --git-sha, --image-digest, and --operator')
  }
  if (options.apply && !/^[0-9a-f]{40}$/i.test(options.gitSha)) {
    throw new Error('--git-sha must be a full 40-character Git commit SHA')
  }
  if (options.apply && !/^sha256:[0-9a-f]{64}$/i.test(options.imageDigest)) {
    throw new Error('--image-digest must be a full sha256 OCI digest')
  }

  return options
}

export function classifyBillingOwnerRow(row) {
  if (row.userId && row.organizationId) return { action: 'conflict', reason: 'multiple-owner-columns' }

  if (row.userId) {
    if (row.userId !== row.referenceId) return { action: 'conflict', reason: 'user-owner-reference-mismatch' }
    if (!row.userOwnerExists) return { action: 'conflict', reason: 'missing-user-owner' }
    return { action: 'preserve' }
  }

  if (row.organizationId) {
    if (row.organizationId !== row.referenceId) {
      return { action: 'conflict', reason: 'organization-owner-reference-mismatch' }
    }
    if (!row.organizationOwnerExists) return { action: 'conflict', reason: 'missing-organization-owner' }
    return { action: 'preserve' }
  }

  if (row.referenceUserExists && row.referenceOrganizationExists) {
    return { action: 'conflict', reason: 'ambiguous-reference' }
  }
  if (row.referenceUserExists) return { action: 'backfill-user' }
  if (row.referenceOrganizationExists) return { action: 'conflict', reason: 'organization-only-reference' }
  return { action: 'conflict', reason: 'unmapped-reference' }
}

function requireDatabaseUrl() {
  const databaseUrl = process.env.POSTGRES_DATABASE_URL
  if (!databaseUrl) throw new Error('POSTGRES_DATABASE_URL is required for billing owner backfill')
  return databaseUrl
}

async function readBatch(client, cursor, batchSize) {
  const result = await client.query(
    `
      SELECT
        customer."id",
        customer."reference_id" AS "referenceId",
        customer."user_id" AS "userId",
        customer."organization_id" AS "organizationId",
        EXISTS (SELECT 1 FROM "public"."user" reference_user WHERE reference_user."id" = customer."reference_id")
          AS "referenceUserExists",
        EXISTS (SELECT 1 FROM "public"."organization" reference_org WHERE reference_org."id" = customer."reference_id")
          AS "referenceOrganizationExists",
        EXISTS (SELECT 1 FROM "public"."user" owner_user WHERE owner_user."id" = customer."user_id")
          AS "userOwnerExists",
        EXISTS (SELECT 1 FROM "public"."organization" owner_org WHERE owner_org."id" = customer."organization_id")
          AS "organizationOwnerExists"
      FROM "billing"."customer" customer
      WHERE ($1::text IS NULL OR customer."id" > $1)
      ORDER BY customer."id"
      LIMIT $2
    `,
    [cursor, batchSize]
  )
  return result.rows
}

function summarize(rows) {
  const decisions = rows.map(row => ({ row, decision: classifyBillingOwnerRow(row) }))
  return {
    decisions,
    conflicts: decisions.filter(item => item.decision.action === 'conflict'),
    updates: decisions.filter(item => item.decision.action === 'backfill-user')
  }
}

async function ensureLedger(client, options) {
  const execution = {
    gitSha: options.gitSha,
    imageDigest: options.imageDigest,
    operator: options.operator,
    invokedAt: new Date().toISOString()
  }
  await client.query(
    `
      INSERT INTO "public"."_ray_data_backfills" ("id", "status", "metadata")
      VALUES ($1, 'running', '{"executions": []}'::jsonb)
      ON CONFLICT ("id") DO NOTHING
    `,
    [billingOwnerBackfillId]
  )
  const executionUpdate = await client.query(
    `
      UPDATE "public"."_ray_data_backfills" SET
        "metadata" = jsonb_set(
          "metadata",
          '{executions}',
          COALESCE("metadata"->'executions', '[]'::jsonb) || $2::jsonb,
          true
        ),
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    [billingOwnerBackfillId, JSON.stringify([execution])]
  )
  if (executionUpdate.rowCount !== 1) throw new Error('Billing owner backfill ledger is unavailable')
  const ledger = await client.query('SELECT * FROM "public"."_ray_data_backfills" WHERE "id" = $1', [
    billingOwnerBackfillId
  ])
  if (ledger.rowCount !== 1) throw new Error('Billing owner backfill ledger is unavailable')

  const unresolved = await client.query(
    `SELECT COUNT(*)::int AS "count" FROM "public"."_ray_data_backfill_conflicts"
     WHERE "backfill_id" = $1 AND "resolved_at" IS NULL`,
    [billingOwnerBackfillId]
  )
  if (unresolved.rows[0].count > 0) {
    throw new Error(`Billing owner backfill has ${unresolved.rows[0].count} unresolved conflict(s)`)
  }

  if (ledger.rows[0].status === 'blocked') {
    await client.query(
      `UPDATE "public"."_ray_data_backfills" SET "status" = 'running', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1`,
      [billingOwnerBackfillId]
    )
  }
  return ledger.rows[0]
}

async function persistBatch(client, cursor, rows, summary) {
  await client.query('BEGIN')
  try {
    if (summary.conflicts.length > 0) {
      for (const conflict of summary.conflicts) {
        await client.query(
          `
            INSERT INTO "public"."_ray_data_backfill_conflicts"
              ("backfill_id", "record_id", "reason", "payload")
            VALUES ($1, $2, $3, $4::jsonb)
            ON CONFLICT ("backfill_id", "record_id") DO UPDATE SET
              "reason" = EXCLUDED."reason",
              "payload" = EXCLUDED."payload",
              "created_at" = CURRENT_TIMESTAMP,
              "resolved_at" = NULL,
              "resolution" = NULL
          `,
          [billingOwnerBackfillId, conflict.row.id, conflict.decision.reason, JSON.stringify(conflict.row)]
        )
      }
      await client.query(
        `
          UPDATE "public"."_ray_data_backfills" SET
            "status" = 'blocked',
            "conflict_count" = (
              SELECT COUNT(*) FROM "public"."_ray_data_backfill_conflicts" WHERE "backfill_id" = $1
            ),
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = $1
        `,
        [billingOwnerBackfillId]
      )
      await client.query('COMMIT')
      return { blocked: true, updated: 0 }
    }

    let updated = 0
    for (const item of summary.updates) {
      const result = await client.query(
        `
          UPDATE "billing"."customer" SET
            "user_id" = $2,
            "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = $1
            AND "reference_id" = $2
            AND "user_id" IS NULL
            AND "organization_id" IS NULL
        `,
        [item.row.id, item.row.referenceId]
      )
      if (result.rowCount !== 1) throw new Error(`Concurrent billing customer change detected: ${item.row.id}`)
      updated += 1
    }

    const nextCursor = rows.at(-1).id
    const ledgerUpdate = await client.query(
      `
        UPDATE "public"."_ray_data_backfills" SET
          "cursor" = $2,
          "status" = 'running',
          "scanned_count" = "scanned_count" + $3,
          "updated_count" = "updated_count" + $4,
          "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $1 AND "cursor" IS NOT DISTINCT FROM $5
      `,
      [billingOwnerBackfillId, nextCursor, rows.length, updated, cursor]
    )
    if (ledgerUpdate.rowCount !== 1) {
      throw new Error(`Concurrent billing owner backfill cursor change detected at ${cursor ?? '<start>'}`)
    }
    await client.query('COMMIT')
    return { blocked: false, updated, cursor: nextCursor }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export async function queryBillingOwnerViolations(client) {
  const result = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE customer."user_id" IS NULL AND customer."organization_id" IS NULL)::int
        AS "missingOwner",
      COUNT(*) FILTER (WHERE customer."user_id" IS NOT NULL AND customer."organization_id" IS NOT NULL)::int
        AS "multipleOwners",
      COUNT(*) FILTER (WHERE customer."user_id" IS NOT NULL AND customer."reference_id" <> customer."user_id")::int
        AS "userMismatch",
      COUNT(*) FILTER (
        WHERE customer."organization_id" IS NOT NULL
          AND customer."reference_id" <> customer."organization_id"
      )::int
        AS "organizationMismatch",
      COUNT(*) FILTER (WHERE customer."user_id" IS NOT NULL AND owner_user."id" IS NULL)::int
        AS "missingUserTarget",
      COUNT(*) FILTER (WHERE customer."organization_id" IS NOT NULL AND owner_org."id" IS NULL)::int
        AS "missingOrganizationTarget"
    FROM "billing"."customer" customer
    LEFT JOIN "public"."user" owner_user ON owner_user."id" = customer."user_id"
    LEFT JOIN "public"."organization" owner_org ON owner_org."id" = customer."organization_id"
  `)
  return result.rows[0]
}

async function completeBackfill(client) {
  const violations = await queryBillingOwnerViolations(client)
  const violationCount = Object.values(violations).reduce((total, value) => total + Number(value), 0)
  if (violationCount > 0) throw new Error(`Billing owner verification failed: ${JSON.stringify(violations)}`)

  const completion = await client.query(
    `
      UPDATE "public"."_ray_data_backfills" SET
        "status" = 'completed',
        "completed_at" = CURRENT_TIMESTAMP,
        "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = $1
    `,
    [billingOwnerBackfillId]
  )
  if (completion.rowCount !== 1) throw new Error('Billing owner backfill ledger disappeared before completion')
  return violations
}

async function dryRun(client, options) {
  let cursor = null
  let scanned = 0
  let updates = 0
  let conflictCount = 0
  const conflicts = []

  while (true) {
    const rows = await readBatch(client, cursor, options.batchSize)
    if (rows.length === 0) break
    const summary = summarize(rows)
    scanned += rows.length
    updates += summary.updates.length
    conflictCount += summary.conflicts.length
    conflicts.push(...summary.conflicts.slice(0, Math.max(0, 100 - conflicts.length)))
    cursor = rows.at(-1).id
  }

  return {
    mode: 'dry-run',
    scanned,
    wouldUpdate: updates,
    conflictCount,
    conflicts: conflicts.map(item => ({ id: item.row.id, reason: item.decision.reason }))
  }
}

async function applyBackfill(client, options) {
  const lock = await client.query('SELECT pg_try_advisory_lock(hashtext($1)) AS "acquired"', [advisoryLockName])
  if (lock.rows[0]?.acquired !== true) throw new Error('Another billing owner backfill process holds the lock')
  try {
    const ledger = await ensureLedger(client, options)
    if (ledger.status === 'completed') return { mode: 'apply', status: 'already-completed' }

    let cursor = ledger.cursor
    let batches = 0
    while (batches < options.maxBatches) {
      const rows = await readBatch(client, cursor, options.batchSize)
      if (rows.length === 0) {
        const violations = await completeBackfill(client)
        return { mode: 'apply', status: 'completed', violations }
      }

      const summary = summarize(rows)
      const result = await persistBatch(client, cursor, rows, summary)
      if (result.blocked) {
        throw new Error(
          `Billing owner backfill blocked by ${summary.conflicts.length} conflict(s) in the current batch`
        )
      }
      cursor = result.cursor
      batches += 1
    }
    return { mode: 'apply', status: 'running', cursor, batches }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [advisoryLockName]).catch(() => undefined)
  }
}

export async function runBillingOwnerBackfill(client, options) {
  return options.apply ? applyBackfill(client, options) : dryRun(client, options)
}

async function main() {
  const options = parseBackfillOptions(process.argv.slice(2))
  const client = new Client({ connectionString: requireDatabaseUrl() })
  await client.connect()
  try {
    const result = await runBillingOwnerBackfill(client, options)
    console.log(`[billing-owner-backfill] ${JSON.stringify(result)}`)
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`[billing-owner-backfill] failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
