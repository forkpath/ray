import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { classifyBillingOwnerRow, parseBackfillOptions, runBillingOwnerBackfill } from './backfill-billing-owners.mjs'

const gitSha = 'a'.repeat(40)
const imageDigest = `sha256:${'b'.repeat(64)}`

const row = overrides => ({
  id: 'customer-1',
  referenceId: 'user-1',
  userId: null,
  organizationId: null,
  referenceUserExists: false,
  referenceOrganizationExists: false,
  userOwnerExists: false,
  organizationOwnerExists: false,
  ...overrides
})

describe('billing owner backfill classification', () => {
  it('backfills only an unambiguous historical user owner', () => {
    assert.deepEqual(classifyBillingOwnerRow(row({ referenceUserExists: true })), { action: 'backfill-user' })
  })

  it('never guesses an organization or ambiguous owner', () => {
    assert.deepEqual(classifyBillingOwnerRow(row({ referenceOrganizationExists: true })), {
      action: 'conflict',
      reason: 'organization-only-reference'
    })
    assert.deepEqual(classifyBillingOwnerRow(row({ referenceUserExists: true, referenceOrganizationExists: true })), {
      action: 'conflict',
      reason: 'ambiguous-reference'
    })
  })

  it('rejects missing, multiple, or mismatched owners', () => {
    assert.deepEqual(classifyBillingOwnerRow(row({})), { action: 'conflict', reason: 'unmapped-reference' })
    assert.deepEqual(classifyBillingOwnerRow(row({ userId: 'user-1', organizationId: 'org-1' })), {
      action: 'conflict',
      reason: 'multiple-owner-columns'
    })
    assert.deepEqual(classifyBillingOwnerRow(row({ userId: 'user-2', userOwnerExists: true })), {
      action: 'conflict',
      reason: 'user-owner-reference-mismatch'
    })
  })

  it('preserves only valid existing user or organization owners', () => {
    assert.deepEqual(classifyBillingOwnerRow(row({ userId: 'user-1', userOwnerExists: true })), {
      action: 'preserve'
    })
    assert.deepEqual(
      classifyBillingOwnerRow(
        row({
          referenceId: 'org-1',
          organizationId: 'org-1',
          organizationOwnerExists: true
        })
      ),
      { action: 'preserve' }
    )
  })
})

describe('billing owner backfill command options', () => {
  it('is read-only by default', () => {
    assert.deepEqual(parseBackfillOptions([]), {
      apply: false,
      batchSize: 250,
      maxBatches: Number.POSITIVE_INFINITY
    })
  })

  it('requires release provenance for apply mode', () => {
    assert.throws(() => parseBackfillOptions(['--apply']), /requires --git-sha, --image-digest, and --operator/)
    assert.deepEqual(
      parseBackfillOptions([
        '--apply',
        '--batch-size=100',
        '--max-batches=2',
        `--git-sha=${gitSha}`,
        `--image-digest=${imageDigest}`,
        '--operator=release-bot'
      ]),
      {
        apply: true,
        batchSize: 100,
        maxBatches: 2,
        gitSha,
        imageDigest,
        operator: 'release-bot'
      }
    )
  })

  it('requires immutable release identifiers', () => {
    assert.throws(
      () =>
        parseBackfillOptions(['--apply', '--git-sha=short', `--image-digest=${imageDigest}`, '--operator=release-bot']),
      /40-character/
    )
    assert.throws(
      () =>
        parseBackfillOptions([
          '--apply',
          `--git-sha=${gitSha}`,
          '--image-digest=sha256:short',
          '--operator=release-bot'
        ]),
      /full sha256/
    )
  })
})

describe('billing owner backfill dry run', () => {
  it('reports every conflict while bounding the returned sample', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => row({ id: `customer-${String(index).padStart(3, '0')}` }))
    let reads = 0
    const client = {
      query: async sql => {
        assert.match(sql, /FROM "billing"\."customer" customer/)
        reads += 1
        return { rows: reads === 1 ? rows : [] }
      }
    }

    const result = await runBillingOwnerBackfill(client, {
      apply: false,
      batchSize: 250,
      maxBatches: Number.POSITIVE_INFINITY
    })
    assert.equal(result.scanned, 101)
    assert.equal(result.conflictCount, 101)
    assert.equal(result.conflicts.length, 100)
  })
})
