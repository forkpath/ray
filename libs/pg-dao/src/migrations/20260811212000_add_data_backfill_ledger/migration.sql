-- Additive control-plane storage for resumable data backfills.
-- This migration does not modify billing data or activate V2 reads.

SET lock_timeout = '5s';

CREATE TABLE "public"."_ray_data_backfills" (
  "id" TEXT NOT NULL,
  "cursor" TEXT,
  "status" TEXT NOT NULL,
  "scanned_count" BIGINT NOT NULL DEFAULT 0,
  "updated_count" BIGINT NOT NULL DEFAULT 0,
  "conflict_count" BIGINT NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ,

  CONSTRAINT "_ray_data_backfills_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "_ray_data_backfills_status_check"
    CHECK ("status" IN ('running', 'blocked', 'completed'))
);

CREATE TABLE "public"."_ray_data_backfill_conflicts" (
  "backfill_id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ,
  "resolution" TEXT,

  CONSTRAINT "_ray_data_backfill_conflicts_pkey" PRIMARY KEY ("backfill_id", "record_id"),
  CONSTRAINT "_ray_data_backfill_conflicts_backfill_id_fkey"
    FOREIGN KEY ("backfill_id") REFERENCES "public"."_ray_data_backfills"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "_ray_data_backfill_conflicts_backfill_id_resolved_at_idx"
  ON "public"."_ray_data_backfill_conflicts"("backfill_id", "resolved_at");

RESET lock_timeout;
