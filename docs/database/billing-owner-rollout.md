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
