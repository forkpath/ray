-- Wave 4 / Expand only.
-- Keep this migration compatible with the legacy application. Backfill, read
-- switching, NOT NULL/CHECK validation, and legacy-column removal belong to
-- later migrations.

SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "public"."_ray_online_migrations" (
  "id" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "_ray_online_migrations_pkey" PRIMARY KEY ("id")
);

ALTER TYPE "billing"."WebhookEventStatus" ADD VALUE IF NOT EXISTS 'received';
ALTER TYPE "billing"."WebhookEventStatus" ADD VALUE IF NOT EXISTS 'processing';

ALTER TABLE "billing"."customer"
  ADD COLUMN IF NOT EXISTS "user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "organization_id" TEXT;

ALTER TABLE "billing"."webhook_event"
  ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "last_attempt_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "processed_at" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_user_id_fkey'
      AND conrelid = '"billing"."customer"'::regclass
  ) THEN
    ALTER TABLE "billing"."customer"
      ADD CONSTRAINT "customer_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "public"."user"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
      NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_organization_id_fkey'
      AND conrelid = '"billing"."customer"'::regclass
  ) THEN
    ALTER TABLE "billing"."customer"
      ADD CONSTRAINT "customer_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE
      NOT VALID;
  END IF;
END
$$;

RESET lock_timeout;
