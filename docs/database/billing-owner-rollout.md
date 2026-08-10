# Billing owner V2 application rollout

The billing owner migration is controlled independently from schema deployment.
All switches default to `false`; deploying compatible code does not change reads
or writes by itself.

| Switch | Effect |
| --- | --- |
| `BILLING_OWNER_V2_DUAL_WRITE` | Keeps `referenceId` and writes exactly one explicit owner column. |
| `BILLING_OWNER_V2_SHADOW_READ` | Executes legacy and V2 queries, reports ID-set differences, and still returns the legacy result. |
| `BILLING_OWNER_V2_READ` | Returns the explicit owner query result. |
| `ORGANIZATION_BILLING_ENABLED` | Allows the later organization billing endpoints to be activated. |

## Organization API boundary

The compatible application exposes these Stripe-only routes behind
`ORGANIZATION_BILLING_ENABLED`:

- `GET /organizations/:organizationId/billing` for any organization member;
- `POST /organizations/:organizationId/billing/checkout` for owners/admins;
- `POST /organizations/:organizationId/billing/portal` for owners/admins.

The Better Auth session supplies the acting user and email. The path supplies
the organization owner; request bodies contain only validated Checkout or
Portal fields. RevenueCat remains user-owned. Client Query Keys include owner
kind and ID so switching organizations cannot reuse a personal or different
organization's cache entry.

## Safe activation order

1. Apply the Expand migration and online indexes.
2. Deploy the compatible application with all switches disabled.
3. Enable dual-write.
4. Backfill every legacy customer and resolve all quarantined records.
5. Enable shadow-read and require zero mismatches for 72 hours.
6. Enable V2 read.
7. Enable organization billing after its API and permission probes pass.

The application rejects out-of-order combinations on startup. V2 read requires
dual-write and shadow-read; organization billing requires V2 read.

Rollback switches in the reverse order: organization billing, V2 read,
shadow-read, then dual-write. Application rollback must keep the additive
database schema in place.

Shadow mismatches are emitted as structured `billing-owner` warnings containing
the owner, optional provider, legacy customer IDs, and V2 customer IDs. They do
not switch the response source. Ambiguous rows with both owner columns set are
rejected instead of guessing ownership.

## Webhook claim state machine

Stripe and RevenueCat deliveries use the existing unique
`(event_id, provider)` row as a durable claim record:

- new deliveries are inserted as `received` with `processed_at = NULL`;
- an atomic conditional update claims only `received` or `failed` as
  `processing`, increments `attempt_count`, and writes `last_attempt_at`;
- successful work completes the claim as `processed` or `skipped` and sets
  `processed_at`;
- failures update the same row to `failed`, keep `processed_at = NULL`, and are
  eligible for a later provider retry;
- deliveries that observe a live `processing` lease fail the request so the
  provider retries without running business synchronization;
- a `processing` attempt older than five minutes can be reclaimed, while its
  `attempt_count` fences the stale attempt from completing the newer claim;
- deliveries that observe `processed` or `skipped` return idempotently.

The unique key is deliberately retained. It identifies the durable event and no
longer prevents retry because failure transitions update the same record.
Provider persistence uses idempotent upserts. Optional provider callbacks must
also be idempotent using the event identifier supplied in their payload or
callback argument.
