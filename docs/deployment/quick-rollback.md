# Digest deployment and quick rollback

This stage consumes the five-image release manifest produced by CI. It never
checks out Git, builds source on the target, downloads a CLI at runtime, or
reverses database DDL.

No production target is configured by this repository yet. The commands below
are deployment assets and an operator runbook; adding a host, runner, secret,
or cloud environment is a separate reviewed operation.

## Runtime layout

- `docker/compose.infrastructure.yml` owns PostgreSQL, Redis, MongoDB, and
  RabbitMQ plus their persistent volumes.
- `docker/compose.application.yml` owns one color of Engine, Pulse, Worker, and
  Web. Blue and green are separate Compose projects and can run concurrently.
- `docker/compose.gateway.yml` owns the single stable Kong gateway. Kong routes
  only to the color-qualified aliases (`engine-blue`, `web-green`, and so on),
  validates a candidate declarative config, and reloads it atomically.
- All three stacks use one explicitly named Docker network. Application and
  gateway stacks treat it as external, so an application rollback cannot
  recreate infrastructure or data volumes.
- Application images come only from the CI release manifest and are rendered
  as `image@sha256:<digest>`. Compose contains no `build` instruction.
- Infrastructure and Kong images are also supplied as reviewed digest
  references in the protected runtime environment file. They do not change as
  a side effect of an application release.

Kong's Admin API is disabled. Its stable container is not restarted during a
normal color switch. The old Konga UI, host-side Nx build, `git pull`, and
in-container `npx prisma` deployment path have been removed.

## One-time infrastructure initialization

The runtime environment file belongs in the deployment target's secret store,
outside the checkout. It must be readable only by its owner:

```bash
chmod 600 /secure/ray/production.env
docker image pull "$(sed -n 's/^REDIS_IMAGE=//p' /secure/ray/production.env)"
docker image pull "$(sed -n 's/^POSTGRES_IMAGE=//p' /secure/ray/production.env)"
docker image pull "$(sed -n 's/^MONGO_IMAGE=//p' /secure/ray/production.env)"
docker image pull "$(sed -n 's/^RABBITMQ_IMAGE=//p' /secure/ray/production.env)"

RAY_NETWORK_NAME=ray-production-platform \
docker compose \
  --project-name ray-infrastructure \
  --env-file /secure/ray/production.env \
  -f docker/compose.infrastructure.yml \
  up -d --no-build --pull never --wait --wait-timeout 180
```

The image values must be operator-reviewed digests. Do not copy the placeholder
values in `examples/runtime.env.example` into a real environment.

## Required release inputs

1. The exact `release-manifest-<sha>-<attempt>` artifact emitted by successful
   `main` or a production tag CI run.
2. A provider-produced backup receipt matching
   `examples/backup-receipt.json`. It must identify the production database,
   have `status=completed`, and be no older than the configured maximum age.
3. A smoke specification matching `examples/smoke.json`. It must cover health,
   auth, user billing, and organization billing. Authenticated checks may set
   `headersFromEnvironment`, mapping a header name to a protected environment
   variable; secret values are never stored in the spec or release ledger.
4. The protected runtime environment file with mode `0600`.
5. An observation specification matching `examples/observation.json`. The URL
   must return one JSON sample with `errorRate`, `p95LatencyMs`,
   `authFailureRate`, `databaseConnections`, and `queueDepth` on every request.
   The controller fails closed on an unavailable, malformed, or over-threshold
   sample. Authentication headers are resolved only from protected environment
   variables.
6. An explicit migration mode: `expand` for a reviewed additive migration, or
   `none` when the release has no database migration. `contract` is rejected.

The files under `docs/deployment/examples` are schema examples only. Their
syntactically valid hashes and placeholder secrets do not identify real images,
backups, databases, or credentials.

## Plan before apply

`plan` is read-only. It validates all identities, backup freshness, smoke
coverage, and the existing installed release without invoking Docker:

```bash
node scripts/deploy/release-controller.mjs plan \
  --environment production \
  --manifest /secure/ray/release-manifest.json \
  --backup-receipt /secure/ray/backup-receipt.json \
  --smoke-spec /secure/ray/smoke.json \
  --observation-spec /secure/ray/observation.json \
  --migration-mode expand \
  --runtime-env /secure/ray/production.env \
  --state-dir /var/lib/ray/releases/production
```

Stop if any owner backfill, readiness, image identity, backup, or smoke input is
ambiguous. The controller never guesses an image, database, or owner.

## Apply order

Apply requires the additional, explicit `--apply` flag:

```bash
node scripts/deploy/release-controller.mjs apply \
  --environment production \
  --manifest /secure/ray/release-manifest.json \
  --backup-receipt /secure/ray/backup-receipt.json \
  --smoke-spec /secure/ray/smoke.json \
  --observation-spec /secure/ray/observation.json \
  --migration-mode expand \
  --runtime-env /secure/ray/production.env \
  --state-dir /var/lib/ray/releases/production \
  --apply
```

The controller performs these operations under an exclusive deployment lock:

1. Pull all five exact image digests. The reviewed Kong digest from the
   protected runtime environment is also pulled before Compose is allowed to
   use `--pull never`.
2. Revalidate the fresh backup receipt.
3. For `expand`, run `migrate`, then `online-migrate`, using the exact Migrator
   digest. For `none`, skip both. In either mode, run the read-only
   `compatibility-check` before starting the candidate.
4. Select the inactive color and start its isolated Compose project with
   `--no-build --pull never --wait`.
5. Probe Engine, Pulse, Worker, and Web directly inside the candidate project.
6. Ensure the stable gateway is healthy, validate the candidate Kong config,
   and atomically reload Kong to the candidate color.
7. Run the health/auth/billing/organization smoke matrix through the stable
   public gateway.
8. Observe error rate, P95 latency, auth failures, database connections, and
   queue depth for the configured window. Any failed sample atomically routes
   Kong back to the prior color and reruns smoke.
9. Persist the candidate as the active release before draining the old color.
   Pulse emits `platform:draining` so WebSocket clients reconnect; Compose then
   gives all services the configured graceful-stop window. The final drain
   result is recorded separately and a cleanup requirement does not falsify
   the active release identity.

The generated Compose environment contains only image identities and release
metadata. Runtime secrets remain in the protected environment file and are not
copied into the ledger.

If readiness, smoke, or observation fails after the switch begins, the
controller atomically restores the previous gateway color, reruns smoke, and
drains the failed candidate. Any additive database changes remain in place.
On a first-ever deployment failure, both the candidate and newly created
gateway are removed so no partial installation is recorded.

Contract Migration is deliberately outside this command. It must never run in
the same release as a blue/green traffic switch. Execute Contract only after
the documented compatibility window has closed and all pre-contract images
have been marked ineligible for rollback.

## Manual rollback

Rollback never invokes Migrator:

```bash
node scripts/deploy/release-controller.mjs rollback \
  --environment production \
  --smoke-spec /secure/ray/smoke.json \
  --runtime-env /secure/ray/production.env \
  --state-dir /var/lib/ray/releases/production \
  --apply
```

By default, the newest prior successful release is selected. The controller
starts it in the inactive color, probes it, atomically switches Kong, reruns
smoke, and drains the superseded color. An operator may select an older
installed SHA with `--to-git-sha <40-character-sha>`. The controller measures
the rollback and fails the RTO gate when it exceeds 300 seconds, while
retaining the truthful installed-state record.

After a Contract Migration, mark pre-contract releases ineligible for rollback
through the release governance process before executing the Contract DDL. Do
not try to recover compatibility with ad-hoc reverse SQL.

## Audit and recovery

```bash
node scripts/deploy/release-controller.mjs status \
  --environment production \
  --state-dir /var/lib/ray/releases/production
```

- `current.json` is the authoritative installed application identity.
- `releases/*.json` contains every successful deployment/rollback record.
- `attempts/*.json` contains failed release attempts and the last completed
  stage without replacing the installed application identity.
- `history.jsonl` is append-only operational history.
- `deployment.lock` prevents concurrent releases. If it remains after a host
  failure, inspect its PID and timestamp before removing it manually.

State files do not replace the external migration ledger. Production operators
must still record the Git SHA, five digests, migration IDs, backup ID, operator,
verification result, and rollback candidate in the governed migration ledger.
