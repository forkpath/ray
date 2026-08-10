# `@libs/billing-config`

Universal Billing catalog and entitlement calculations.

- imports only `@libs/billing-contract`;
- never reads `process.env` or `import.meta.env`;
- exposes a provider-neutral default catalog for rendering and entitlement
  lookup;
- accepts Stripe Price IDs and RevenueCat Product IDs through
  `createBillingConfig` at runtime boundaries.

```ts
import { createBillingConfig, getActivePlan } from '@libs/billing-config'

const catalog = createBillingConfig({
  stripe: { premiumMonthlyPriceId: env.STRIPE_MONTHLY_PRICE_ID }
})

const activePlan = getActivePlan(summary, catalog)
```

Provider SDKs, persistence, and environment parsing belong in web, native, or
Node adapters rather than this project.
