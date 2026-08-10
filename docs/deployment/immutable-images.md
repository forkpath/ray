# Immutable application images

Ray publishes application images only after the ordinary CI job has completed
successfully. The reusable `release-images.yml` workflow accepts calls from the
repository CI workflow; it cannot be dispatched independently.

## Publication policy

- A push to `main` publishes Engine, Pulse, Worker, Web, and Migrator images.
- A `v*` production tag publishes the same five images only when the tagged
  commit is an ancestor of `main`.
- Every image receives the full 40-character Git SHA tag. A production tag adds
  a second version tag; `latest` is never published.
- Deployment systems must pull `image@sha256:<digest>` from the generated
  release manifest. Tags are discovery metadata, not deployment identities.
- The build uses one reviewed Node base digest, fixed pnpm and Prisma versions,
  an SBOM, and maximum provenance attestations. All external Actions are pinned
  to complete commit SHAs.

The workflow uploads `release-manifest-<git-sha>-<run-attempt>` with this shape:

```json
{
  "schemaVersion": 1,
  "gitSha": "<40-character-git-sha>",
  "ref": "refs/heads/main",
  "images": {
    "engine": {
      "image": "ghcr.io/forkpath/ray-engine",
      "digest": "sha256:<64-hex-characters>"
    }
  }
}
```

The real manifest contains exactly five entries. Assembly fails when a service
is missing, duplicated, built from another Git SHA/ref, or lacks an OCI digest.

The consumer implementation and rollback runbook are documented in
`docs/deployment/quick-rollback.md`.

## Migrator

The Migrator is independent from every application runtime. It contains the
reviewed Prisma migrations and database maintenance scripts, Prisma `7.8.0`,
`pg` `8.16.3`, and pnpm `10.25.0`. It runs as the unprivileged `node` user and
never downloads a CLI at runtime.

Supported commands are:

```text
migrate
online-migrate
billing-owner-backfill
billing-contract-readiness
```

For example, a release controller will invoke a reviewed digest as follows;
the database URL must come from the target secret store and must not be placed
in a manifest or shell history:

```bash
docker run --rm \
  -e POSTGRES_DATABASE_URL \
  ghcr.io/forkpath/ray-migrator@sha256:<digest> migrate
```

Backfill remains dry-run by default. Apply mode still requires the Git SHA,
Migrator digest, and operator identity documented in
`docs/database/billing-owner-backfill.md`.

## Deliberate boundary

The former tag-triggered SSH workflow was retired because it checked out source
and built mutable images on the target server. This stage publishes immutable
inputs only; it does not connect to or restart a deployment target. The next
deployment stage must consume the release manifest, run the Migrator by digest,
wait for readiness and smoke tests, record the installed manifest, and roll back
by restoring the previous application digests while retaining additive database
changes.
