import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildReadinessReport,
  evaluateReleaseEvidence,
  parseReadinessOptions
} from './check-billing-contract-readiness.mjs'

const now = new Date('2026-08-11T00:00:00.000Z')
const firstGitSha = '1'.repeat(40)
const secondGitSha = '2'.repeat(40)
const firstDigest = `sha256:${'a'.repeat(64)}`
const secondDigest = `sha256:${'b'.repeat(64)}`
const readyEvidence = {
  schemaVersion: 1,
  environment: 'production',
  approvedBy: 'release-manager@example.com',
  v2ReadEnabledAt: '2026-07-27T00:00:00.000Z',
  shadowMismatchZeroSince: '2026-07-24T00:00:00.000Z',
  successfulProductionReleases: [
    { gitSha: firstGitSha, imageDigest: firstDigest, deployedAt: '2026-07-28T00:00:00.000Z' },
    { gitSha: secondGitSha, imageDigest: secondDigest, deployedAt: '2026-08-02T00:00:00.000Z' }
  ],
  allInstancesV2: true,
  legacyRollbackClosed: true
}

describe('billing contract readiness evidence', () => {
  it('accepts only the explicit evidence path option', () => {
    assert.deepEqual(parseReadinessOptions(['--evidence=release.json']), { evidencePath: 'release.json' })
    assert.throws(() => parseReadinessOptions([]), /requires exactly one/)
    assert.throws(() => parseReadinessOptions(['--evidence=']), /must not be empty/)
  })

  it('requires fourteen stable days, two immutable releases, and rollback closure', () => {
    const result = evaluateReleaseEvidence(readyEvidence, now)
    assert.equal(result.ready, true)
    assert.equal(result.details.validProductionReleaseCount, 2)

    const blocked = evaluateReleaseEvidence(
      {
        ...readyEvidence,
        v2ReadEnabledAt: '2026-08-10T00:00:00.000Z',
        allInstancesV2: false,
        legacyRollbackClosed: false
      },
      now
    )
    assert.equal(blocked.ready, false)
    assert.equal(blocked.checks.v2ReadStableFor14Days, false)
    assert.equal(blocked.checks.allInstancesV2, false)
    assert.equal(blocked.checks.legacyRollbackClosed, false)
  })

  it('does not count duplicate or pre-V2 releases', () => {
    const result = evaluateReleaseEvidence(
      {
        ...readyEvidence,
        successfulProductionReleases: [
          readyEvidence.successfulProductionReleases[0],
          readyEvidence.successfulProductionReleases[0],
          { gitSha: secondGitSha, imageDigest: secondDigest, deployedAt: '2026-07-20T00:00:00.000Z' }
        ]
      },
      now
    )
    assert.equal(result.ready, false)
    assert.equal(result.details.validProductionReleaseCount, 1)
  })
})

describe('billing contract readiness report', () => {
  it('fails closed when either evidence or database gates fail', () => {
    const release = evaluateReleaseEvidence(readyEvidence, now)
    const database = { ready: false, checks: { backfillCompleted: false }, details: {} }
    const report = buildReadinessReport(release, database)
    assert.equal(report.ready, false)
    assert.equal(report.contractMigrationPresent, false)
    assert.match(report.message, /blocked/)
  })
})
