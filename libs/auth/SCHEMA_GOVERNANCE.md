# Better Auth schema governance

`libs/pg-dao/src/models/auth.prisma` is the version-controlled physical database contract. Better Auth's generated schema is an input to review, not a file that may overwrite that contract.

## Read-only contract check

Run:

```sh
pnpm auth:schema-check
```

The target invokes the repository-pinned Better Auth CLI, generates a candidate under the operating system's temporary directory, and compares:

- logical models, fields, types, nullability, defaults, relations, indexes and unique constraints;
- physical `public` schema ownership, table names and snake_case column mappings;
- explicitly allowed tracked-only fields from `auth-schema-policy.json`.

The command overrides database, email and OAuth settings with non-routable placeholders. It does not connect to PostgreSQL and removes the generated candidate before exiting. The target is deterministic and cacheable.

## Explicit maintenance candidate

Run:

```sh
pnpm auth:schema-update
```

This non-cacheable target writes a raw candidate and a comparison report to `tmp/auth-schema-candidate/`. It never modifies the tracked Prisma schema. A maintainer must review the report, update the physical contract deliberately, and create a Prisma migration through the normal database workflow.

Runtime Better Auth packages and the tooling package `auth` must use the same exact version. Upgrade all four declarations together and keep local extension whitelist entries minimal; stale whitelist entries fail the contract check.

## Better Auth 1.6.22 compatibility bridge

Better Auth 1.6.22 introduced `TwoFactor.failedVerificationCount` and
`TwoFactor.lockedUntil`. The physical schema expands before the runtime upgrade so
the current 1.6.2 application and the future 1.6.x application can both run on the
same database. While runtime and CLI remain on 1.6.2, these two tracked fields are
temporarily listed as local extensions in `auth-schema-policy.json`.

The runtime upgrade PR must remove both whitelist entries. A clean schema check on
the upgraded CLI then proves the fields are owned by Better Auth rather than by a
permanent local exception.

The legacy `auth:generate-auth-schema` target remains fail-closed so old automation cannot resume destructive schema generation.
