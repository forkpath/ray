# Platform acceptance matrix

This document defines the deterministic acceptance boundary for the current
platform migration. It is a governance contract: deleting or renaming the
listed behavioral evidence must fail `ray:test` until the replacement evidence
is reviewed and recorded.

## CI execution model

Pull requests and `dev` pushes run the standard Nx targets:

```text
lint -> typecheck -> test -> build
```

The Web E2E project exposes Playwright as the standard cached `test` target.
It depends on the production Web build, starts the generated Nitro server on
port `4300`, and runs Chromium against that server. Authentication, billing and
organization provider calls are intercepted by a deterministic in-process
provider mock. No external account, secret, payment or email side effect is
required in normal CI.

Provider sandbox verification is intentionally not part of pull-request CI.
Stripe and RevenueCat sandbox runs belong in a controlled nightly environment
after its secrets, test tenants and cleanup policy are explicitly provisioned.

## Acceptance evidence

| Capability | Executed evidence | Required behavior |
| --- | --- | --- |
| Web journey | `web-e2e:test` | unauthenticated redirect, registration, login, organization creation/context switch, user billing and organization permission denial |
| Authentication | `auth-server:integration-test` | registration, verification, login, session lifecycle, logout and organization invitation acceptance |
| Organization billing | `engine:test` | owner derived from session/path and member denied from checkout management |
| Billing webhook | `billing-server:test` | concurrent claim exclusivity, duplicate delivery idempotency and failed-event retry |
| Pulse | `pulse:test` | handshake authentication, membership revalidation, revoked/slow-client disconnect, scoped smoke envelope and dependency readiness |
| Worker | `worker-kernel:test`, `worker:test` | inbox deduplication, durable retry, fifth-attempt DLQ, ack/requeue policy and readiness |
| PostgreSQL | `pg-dao:test` | expand migration safety, billing owner backfill/readiness and database URL governance |
| Release | `ray:test` | required smoke categories, deterministic probes, observation thresholds and application-digest-only rollback |

The root governance test is
`scripts/ci/platform-acceptance.test.mjs`. It verifies that the matrix remains
wired into standard Nx and CI semantics; it does not replace execution of the
underlying tests.

## Post-release gate

The release controller runs health, authentication, user billing and
organization billing probes after candidate readiness and before the
observation window completes. A failed smoke check or breached observation
threshold switches traffic back to the previous application color and restores
only previous application image digests. Expand database migrations remain in
place and Contract migrations are rejected by this release path.
