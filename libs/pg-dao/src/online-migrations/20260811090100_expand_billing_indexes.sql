-- CREATE INDEX CONCURRENTLY must not run inside an explicit transaction.
-- A short lock timeout makes this migration fail fast instead of waiting on
-- online traffic. Operators must inspect/drop an INVALID same-name index
-- before resolving and retrying a failed migration.

SET lock_timeout = '5s';
-- statement-breakpoint
SET statement_timeout = '0';
-- statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_index index_state
    JOIN pg_class index_relation ON index_relation.oid = index_state.indexrelid
    WHERE index_relation.relname IN (
      'customer_user_id_provider_key_v2',
      'customer_organization_id_provider_key_v2',
      'subscription_customer_id_status_created_at_idx',
      'order_customer_id_status_created_at_idx',
      'member_organization_id_user_id_key',
      'organization_role_organization_id_role_key',
      'invitation_organization_id_status_idx',
      'invitation_email_status_idx'
    )
      AND NOT index_state.indisvalid
  ) THEN
    RAISE EXCEPTION 'Wave 4 Expand found an INVALID target index; inspect it and DROP INDEX CONCURRENTLY before retrying';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."member"
    GROUP BY "organization_id", "user_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Wave 4 Expand found duplicate Member(organizationId,userId) rows; review and resolve ownership before retrying';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."organization_role"
    GROUP BY "organization_id", "role"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Wave 4 Expand found duplicate OrganizationRole(organizationId,role) rows; review permissions before retrying';
  END IF;
END
$$;
-- statement-breakpoint

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "customer_user_id_provider_key_v2"
  ON "billing"."customer" ("user_id", "provider")
  WHERE "user_id" IS NOT NULL;
-- statement-breakpoint

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "customer_organization_id_provider_key_v2"
  ON "billing"."customer" ("organization_id", "provider")
  WHERE "organization_id" IS NOT NULL;
-- statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "subscription_customer_id_status_created_at_idx"
  ON "billing"."subscription" ("customer_id", "status", "created_at");
-- statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "order_customer_id_status_created_at_idx"
  ON "billing"."order" ("customer_id", "status", "created_at");
-- statement-breakpoint

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "member_organization_id_user_id_key"
  ON "public"."member" ("organization_id", "user_id");
-- statement-breakpoint

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "organization_role_organization_id_role_key"
  ON "public"."organization_role" ("organization_id", "role");
-- statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "invitation_organization_id_status_idx"
  ON "public"."invitation" ("organization_id", "status");
-- statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "invitation_email_status_idx"
  ON "public"."invitation" ("email", "status");
-- statement-breakpoint

RESET statement_timeout;
-- statement-breakpoint
RESET lock_timeout;
