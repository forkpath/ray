# PostgreSQL online migrations

Online migrations contain PostgreSQL operations that cannot safely run inside
the transaction used by Prisma Migrate, especially `CREATE INDEX CONCURRENTLY`.
They are versioned under `libs/pg-dao/src/online-migrations` and executed by a
fixed repository script; they are never Nx-cached.

## Deployment order

1. Run `pnpm nx run pg-dao:deploy` to apply additive Prisma migrations.
2. Run `pnpm nx run pg-dao:online-migrate` with `POSTGRES_DATABASE_URL` set.
3. Verify the `_ray_online_migrations` ledger and the release manifest before
   deploying code that depends on the new indexes.

The runner holds a PostgreSQL advisory lock, verifies the migration checksum,
executes each statement in autocommit mode, and records the migration only
after every statement succeeds. Re-running an applied migration is a no-op.

## Failure policy

- Duplicate Member or OrganizationRole keys produce a structured
  `conflict-report` and stop before creating an index. Review every record;
  never merge roles or permissions automatically.
- A failed concurrent build can leave an INVALID index. The runner reports it
  and stops. Inspect `pg_index` first, then remove only the confirmed INVALID
  index with `DROP INDEX CONCURRENTLY` before retrying.
- A five-second `lock_timeout` makes online DDL exit instead of waiting behind
  application traffic. Reschedule and rerun the same command.
- Do not reverse additive database DDL during an application rollback.

Prisma migrations, online migrations, database cleanup, and deployment targets
must remain non-cacheable and must not run in ordinary PR verification.
