# `@libs/billing-server`

Node-only Billing provider and persistence adapter.

It owns:

- Prisma persistence for Billing customers, subscriptions, orders, and webhook events;
- Stripe Checkout, Portal, and webhook synchronization;
- RevenueCat server-to-server webhook synchronization;
- owner-aware dual-write, shadow-read, and V2 read compatibility;
- the validated server environment and provider catalog configuration.

Billing entry points accept a discriminated `BillingOwner`. User HTTP routes
must derive it from the Better Auth session; organization routes must derive it
from the authorized path organization. Never accept an arbitrary owner ID from
the request body. See `docs/database/billing-owner-rollout.md` for flag order.

Engine imports this public API directly. The old `@libs/billing/server` and
`@libs/billing/web` paths are deprecated compatibility facades for one release.
Browser and native projects must not import this project.

## Webhook claim lifecycle

Stripe and RevenueCat events share the same durable lifecycle:

1. upsert the unique `(eventId, provider)` record as `received`;
2. atomically claim only `received` or `failed` records as `processing`;
3. increment `attemptCount` and set `lastAttemptAt` for every claimed attempt;
4. finish as `processed` or `skipped`, or preserve the same row as `failed`.

Terminal events return idempotently without running provider synchronization
again. A concurrent delivery that did not win the claim fails the request so
the provider retries instead of treating unfinished work as accepted. A
five-minute processing lease allows an interrupted attempt to be reclaimed;
`attemptCount` fences stale attempts from completing a newer claim. Failed
events remain claimable, so provider retries update the existing row instead of
colliding with its unique key. Provider synchronization is implemented with
idempotent upserts, and optional callbacks must also be idempotent by event ID.

```bash
pnpm nx run billing-server:lint
pnpm nx run billing-server:typecheck
pnpm nx run billing-server:test
```
