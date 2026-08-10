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

Framework-neutral server configuration contracts live in `server-kernel`,
tagged `type:contract`, `runtime:universal`, and `domain:platform`. The project
defines the configuration shape but never reads environment variables or imports
NestJS, database clients, caches, or message brokers. `server-nest` is the
explicit Node adapter for environment loading, exception filters, response
interceptors, throttling guards, decorators, and Nest i18n integration.
`server-redis` is the explicit Node adapter for the ioredis client lifecycle and
Redis helpers. `server-rabbitmq` owns the Nest RabbitMQ connection, publisher,
exchange registration, and bounded prefetch policy. Engine and Worker compose
that adapter through its public API. `mongo-dao` and the remaining `srv-shared`
infrastructure adapters consume the kernel contract. The old `@libs/srv-core`
path resolves directly to `server-nest`; previous `srv-shared` i18n, Redis, and
RabbitMQ exports are type/module-only compatibility bridges for one release.

All `@libs/` path mappings are now either a project root public API or a finite,
named subpath entry point. Wildcard mappings such as `@libs/package/*` are
forbidden by CI because they let consumers bypass project boundaries and import
arbitrary source files. Runtime entry points such as `monitoring/web`,
`analytics/mobile`, and the one-release compatibility paths remain explicit and
auditable.

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

Shared theme values, breakpoints, and the deterministic `cn()` helper now live
in `ui-core`, tagged `type:util`, `runtime:universal`, and `domain:shared`. Runtime
consumers import this boundary directly. DOM media hooks and platform-specific
SVG loaders stay outside the universal project; the old
`@libs/ui-shared/common` path is a temporary compatibility alias while the
facade remains available for one release.

React DOM components, browser media hooks, Web SVG React wrappers, and browser
Tailwind styles live in `ui-web`, tagged `type:ui`, `runtime:web`, and
`domain:shared`. Web, Desktop, Extension, and Studio import its public API.
`@libs/ui-shared/web` and `@libs/ui-shared/common` are now one-release exact-path
aliases that resolve directly to `ui-web`. They do not add a `ui-shared →
ui-web` project edge.

React Native components, native SVG loaders, Uniwind declarations, and Mobile
styles live in `ui-native`, tagged `type:ui`, `runtime:native`, and
`domain:shared`. Mobile imports its public API directly. The old
`@libs/ui-shared/mobile` and deep `@libs/ui-shared/mobile/*` paths are
one-release exact-path aliases resolving directly to `ui-native`; they do not
add a `ui-shared → ui-native` graph edge. Web and Native own separate SVG and
base-style copies, so neither runtime depends on the other.

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
- `ui-shared`: remove after one compatibility release. Universal core, Web UI,
  and Native UI are now independent and the facade owns no runtime source;
- `api-client`: remove after one compatibility release of its frozen Billing
  exports. It is explicitly tagged `domain:composition` while it aggregates
  domain wrappers; new runtime consumers use `billing-client`, and the lower
  shared transport remains isolated in `api-core`.

Adding another facade requires changing the CI allowlist and documenting its
removal condition. Wave 3 is complete only when this list is empty.
