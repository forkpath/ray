# Billing owner backfill and Contract gate

This runbook separates historical data repair from the eventual destructive
Contract migration. Nothing in this change removes `reference_id`, validates
the new foreign keys, or adds the exclusive-owner check constraint.

## Safety model

- The command is read-only unless `--apply` is present.
- Apply mode requires a full Git commit SHA, immutable OCI image digest, and
  operator identity. Every invocation is appended to the durable ledger.
- A PostgreSQL advisory lock allows only one runner. It fails immediately when
  another runner owns the lock.
- Work is ordered by Customer ID and committed one batch at a time. The ledger
  cursor and counters make interruption and restart safe.
- Only a `reference_id` that uniquely matches a User is automatically copied to
  `user_id`. Organization-only, ambiguous, missing, or inconsistent ownership
  is quarantined and blocks the run.
- The runner never invents organization ownership and never deletes a Customer.

The additive migration must be deployed before either command is used:

`20260811212000_add_data_backfill_ledger`

## Dry run

Dry run is the required first step and performs no writes:

```bash
POSTGRES_DATABASE_URL='<redacted>' pnpm nx run pg-dao:billing-owner-backfill -- --batch-size=250
```

The result reports all counts and at most 100 conflict samples. A nonzero
`conflictCount` must be investigated before apply mode.

## Apply and resume

Run from the reviewed migrator image, not a developer workstation:

```bash
POSTGRES_DATABASE_URL='<redacted>' pnpm nx run pg-dao:billing-owner-backfill -- \
  --apply \
  --batch-size=250 \
  --max-batches=20 \
  --git-sha='<40-character-git-sha>' \
  --image-digest='sha256:<64-hex-characters>' \
  --operator='<release-identity>'
```

Re-running the same command resumes from the saved cursor. A conflicting batch
does not advance the cursor or update any Customer. It stores the source row and
reason in `_ray_data_backfill_conflicts`, marks the ledger `blocked`, and exits
nonzero.

Conflict resolution is deliberately not automated. A reviewed operator must
establish the authoritative owner, update the Customer through an audited data
repair, then mark the quarantine row resolved with `resolved_at` and a concrete
`resolution`. The next run re-reads the blocked batch and verifies the repair.

## Contract readiness evidence

The Contract checker requires a locally supplied, reviewed JSON file. Example:

```json
{
  "schemaVersion": 1,
  "environment": "production",
  "approvedBy": "release-manager@example.com",
  "v2ReadEnabledAt": "2026-09-01T00:00:00.000Z",
  "shadowMismatchZeroSince": "2026-08-29T00:00:00.000Z",
  "successfulProductionReleases": [
    {
      "gitSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "imageDigest": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "deployedAt": "2026-09-02T00:00:00.000Z"
    },
    {
      "gitSha": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "imageDigest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "deployedAt": "2026-09-10T00:00:00.000Z"
    }
  ],
  "allInstancesV2": true,
  "legacyRollbackClosed": true
}
```

Run the read-only gate after V2 has been live for at least 14 days:

```bash
POSTGRES_DATABASE_URL='<redacted>' pnpm nx run pg-dao:billing-contract-readiness -- \
  --evidence='/absolute/path/to/production-evidence.json'
```

The checker opens a `REPEATABLE READ, READ ONLY` transaction and fails closed
unless all release and database gates pass: two post-V2 immutable releases,
every instance on V2, legacy rollback closed, completed backfill, zero owner
violations, zero unresolved quarantine rows, and zero duplicate membership/role
keys.

Passing this checker does not run or generate Contract DDL. The destructive
migration remains a separate reviewed release and must never share a release
with blue/green traffic switching.
