# `@libs/billing-server`

Node-only Billing provider and persistence adapter.

It owns:

- Prisma persistence for Billing customers, subscriptions, orders, and webhook events;
- Stripe Checkout, Portal, and webhook synchronization;
- RevenueCat server-to-server webhook synchronization;
- the validated server environment and provider catalog configuration.

Engine imports this public API directly. The old `@libs/billing/server` and
`@libs/billing/web` paths are deprecated compatibility facades for one release.
Browser and native projects must not import this project.

```bash
pnpm nx run billing-server:lint
pnpm nx run billing-server:typecheck
pnpm nx run billing-server:test
```
