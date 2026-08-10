# Nx project boundary policy

Every Nx project has three orthogonal tags:

- `type:app|feature|data-access|contract|ui|util|platform` describes the
  architectural responsibility;
- `runtime:node|web|native|universal` describes where its public API can run;
- `domain:auth|billing|organization|shared|platform|composition` describes
  ownership.

The ESLint module-boundary rule evaluates all three dimensions. Because Nx
applies every matching source constraint, a dependency must satisfy its source
project's runtime, type, and domain rules. There is no wildcard fallback.

## Runtime rules

- Universal code can depend only on universal code.
- Web and native code cannot depend on each other or on Node code.
- Node code can depend on Node or universal code.
- An application is a composition root, but it still cannot depend on another
  application.

## Type rules

- Contracts depend only on contracts and utilities.
- UI depends only on UI, contracts, and utilities.
- Data access depends only on contracts, utilities, and runtime-compatible
  platform adapters.
- Platform adapters may compose platform, data-access, contract, and utility
  projects.
- Feature and application projects may compose the lower layers but cannot
  create application-to-application edges.

## Domain rules

- Shared and platform projects cannot depend on product domains.
- Auth can depend on auth, shared, and platform projects.
- Billing and organization can depend on their own domain, Auth contracts,
  shared, and platform projects.
- Composition roots can combine all domains.

Cross-domain access to Auth is represented by the additive
`boundary:auth-contract` marker. Billing and organization cannot target the
broader `domain:auth` tag, so future Auth server and client projects remain
inaccessible even though they share the Auth domain.

Billing values and transport-neutral records now live behind the additive
`boundary:billing-contract` marker in `billing-contract`. The legacy Billing
facade re-exports these contracts for rollback compatibility while frontend
consumers migrate to the explicit universal boundary. `billing-config` owns the
pure catalog builder and entitlement/price calculations. Runtime adapters inject
provider identifiers, so the universal project never reads environment values.
`billing-client` owns the authenticated HTTP/query adapter and includes owner
kind and user ID in cache keys without sending that ID as authorization data.
`billing-server` owns the Node-only Prisma persistence plus Stripe and RevenueCat
server providers. Engine imports that explicit boundary directly; browser and
native projects are guarded from it. The old `@libs/billing/server` and
`@libs/billing/web` paths remain one-release exact-path aliases for rollback.
They resolve directly to `billing-server` rather than creating a facade project
edge, so PG changes do not invalidate browser or native projects.

The RevenueCat client adapter now lives in `billing-native`, tagged
`type:data-access`, `runtime:native`, and `domain:billing`. Mobile composition
imports that project directly; `@libs/billing/mobile` remains only as a
deprecated exact-path alias for rollback without adding a facade graph edge.

## Transitional facade debt

`boundary:facade` is a narrow migration exception, not a fourth architecture
dimension. It allows existing consumers to keep their import paths while a
mixed project is split. The allowlist is guarded in CI and currently contains:

- `auth`: remove after one compatibility release. `auth-contract`, `auth-web`,
  `auth-native`, and `auth-server` now own the universal, browser, native, and
  Node contracts respectively. Runtime consumers no longer import the mixed
  facade; its deprecated exports remain only as a rollback bridge;
- `billing`: remove after one compatibility release. `billing-contract`,
  `billing-config`, `billing-client`, `billing-native`, and `billing-server` now
  own the universal, native, and Node responsibilities. Engine no longer imports
  the mixed facade; its deprecated server paths remain only as rollback bridges;
- `ui-shared`: remove after universal core, web UI, and native UI projects are
  independent;
- `api-client`: remove after one compatibility release of its frozen Billing
  exports. It is explicitly tagged `domain:composition` while it aggregates
  domain wrappers; new runtime consumers use `billing-client`, and the lower
  shared transport remains isolated in `api-core`.

Adding another facade requires changing the CI allowlist and documenting its
removal condition. Wave 3 is complete only when this list is empty.
