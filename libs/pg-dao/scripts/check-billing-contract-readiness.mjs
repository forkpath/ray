import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import pg from 'pg'

import { billingOwnerBackfillId, queryBillingOwnerViolations } from './backfill-billing-owners.mjs'

const { Client } = pg
const dayMs = 24 * 60 * 60 * 1000

function parseTimestamp(value, field) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw new Error(`${field} must be an ISO-8601 timestamp`)
  return timestamp
}

export function parseReadinessOptions(argv) {
  if (argv.length !== 1 || !argv[0].startsWith('--evidence=')) {
    throw new Error('billing contract readiness requires exactly one --evidence=<path> option')
  }
  const evidencePath = argv[0].slice('--evidence='.length)
  if (!evidencePath) throw new Error('--evidence path must not be empty')
  return { evidencePath }
}

export function evaluateReleaseEvidence(evidence, now = new Date()) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('readiness evidence must be a JSON object')
  }

  const nowTimestamp = now.getTime()
  const v2ReadEnabledAt = parseTimestamp(evidence.v2ReadEnabledAt, 'v2ReadEnabledAt')
  const shadowMismatchZeroSince = parseTimestamp(evidence.shadowMismatchZeroSince, 'shadowMismatchZeroSince')
  if (v2ReadEnabledAt > nowTimestamp || shadowMismatchZeroSince > nowTimestamp) {
    throw new Error('readiness evidence timestamps must not be in the future')
  }
  if (evidence.schemaVersion !== 1 || evidence.environment !== 'production') {
    throw new Error('readiness evidence must use schemaVersion 1 for the production environment')
  }
  if (typeof evidence.approvedBy !== 'string' || evidence.approvedBy.trim().length === 0) {
    throw new Error('readiness evidence requires a non-empty approvedBy')
  }

  const releases = Array.isArray(evidence.successfulProductionReleases) ? evidence.successfulProductionReleases : []
  const validReleases = releases.filter(release => {
    if (!release || typeof release !== 'object') return false
    if (typeof release.gitSha !== 'string' || !/^[0-9a-f]{40}$/i.test(release.gitSha)) return false
    if (typeof release.imageDigest !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(release.imageDigest)) {
      return false
    }
    const deployedAt = Date.parse(release.deployedAt)
    return Number.isFinite(deployedAt) && deployedAt >= v2ReadEnabledAt && deployedAt <= nowTimestamp
  })
  const uniqueReleaseCount = new Set(validReleases.map(release => `${release.gitSha}:${release.imageDigest}`)).size

  const checks = {
    v2ReadStableFor14Days: nowTimestamp - v2ReadEnabledAt >= 14 * dayMs,
    shadowMismatchZeroBeforeV2Read: shadowMismatchZeroSince <= v2ReadEnabledAt,
    shadowMismatchZeroFor72Hours: nowTimestamp - shadowMismatchZeroSince >= 3 * dayMs,
    twoSuccessfulProductionReleases: uniqueReleaseCount >= 2,
    allInstancesV2: evidence.allInstancesV2 === true,
    legacyRollbackClosed: evidence.legacyRollbackClosed === true
  }

  return {
    checks,
    details: {
      approvedBy: evidence.approvedBy,
      v2ReadEnabledAt: new Date(v2ReadEnabledAt).toISOString(),
      shadowMismatchZeroSince: new Date(shadowMismatchZeroSince).toISOString(),
      validProductionReleaseCount: uniqueReleaseCount
    },
    ready: Object.values(checks).every(Boolean)
  }
}

export async function queryDatabaseReadiness(client) {
  const ownerViolations = await queryBillingOwnerViolations(client)
  const result = await client.query(
    `
      SELECT
        (SELECT COUNT(*)::int
         FROM "public"."_ray_data_backfill_conflicts"
         WHERE "backfill_id" = $1 AND "resolved_at" IS NULL) AS "unresolvedBackfillConflicts",
        (SELECT COUNT(*)::int FROM (
          SELECT "organization_id", "user_id"
          FROM "public"."member"
          GROUP BY "organization_id", "user_id"
          HAVING COUNT(*) > 1
        ) duplicate_memberships) AS "duplicateMemberships",
        (SELECT COUNT(*)::int FROM (
          SELECT "organization_id", "role"
          FROM "public"."organization_role"
          GROUP BY "organization_id", "role"
          HAVING COUNT(*) > 1
        ) duplicate_roles) AS "duplicateOrganizationRoles",
        (SELECT "status" FROM "public"."_ray_data_backfills" WHERE "id" = $1) AS "backfillStatus"
    `,
    [billingOwnerBackfillId]
  )

  const database = { ...ownerViolations, ...result.rows[0] }
  const checks = {
    ownerViolationsZero: Object.values(ownerViolations).every(value => Number(value) === 0),
    unresolvedBackfillConflictsZero: Number(database.unresolvedBackfillConflicts) === 0,
    duplicateMembershipsZero: Number(database.duplicateMemberships) === 0,
    duplicateOrganizationRolesZero: Number(database.duplicateOrganizationRoles) === 0,
    backfillCompleted: database.backfillStatus === 'completed'
  }
  return { checks, details: database, ready: Object.values(checks).every(Boolean) }
}

export function buildReadinessReport(release, database) {
  return {
    ready: release.ready && database.ready,
    release,
    database,
    contractMigrationPresent: false,
    message:
      release.ready && database.ready
        ? 'Readiness gates passed. Contract DDL still requires a separately reviewed migration.'
        : 'Contract migration is blocked. Resolve every failed gate before authoring Contract DDL.'
  }
}

function requireDatabaseUrl() {
  const databaseUrl = process.env.POSTGRES_DATABASE_URL
  if (!databaseUrl) throw new Error('POSTGRES_DATABASE_URL is required for billing contract readiness')
  return databaseUrl
}

async function main() {
  const { evidencePath } = parseReadinessOptions(process.argv.slice(2))
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'))
  const release = evaluateReleaseEvidence(evidence)
  const client = new Client({ connectionString: requireDatabaseUrl() })
  await client.connect()
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const database = await queryDatabaseReadiness(client)
    await client.query('ROLLBACK')
    const report = buildReadinessReport(release, database)
    console.log(`[billing-contract-readiness] ${JSON.stringify(report)}`)
    if (!report.ready) process.exitCode = 1
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`[billing-contract-readiness] failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
