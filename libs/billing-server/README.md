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

```bash
pnpm nx run billing-server:lint
pnpm nx run billing-server:typecheck
pnpm nx run billing-server:test
```
