-- Expand-only migration for durable Worker inbox/idempotency state.
-- The application remains compatible when this table is present but unused.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE "public"."worker_inbox" (
    "id" TEXT NOT NULL,
    "consumer" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "envelope_version" INTEGER NOT NULL,
    "envelope" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMPTZ,
    "next_attempt_at" TIMESTAMPTZ,
    "processed_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "worker_inbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "worker_inbox_attempts_check" CHECK (
      "attempt_count" >= 0 AND "max_attempts" BETWEEN 1 AND 20
    ),
    CONSTRAINT "worker_inbox_status_check" CHECK (
      "status" IN ('received', 'processing', 'retry_scheduled', 'processed', 'dead_lettered')
    )
);

CREATE UNIQUE INDEX "worker_inbox_consumer_message_id_key"
  ON "public"."worker_inbox"("consumer", "message_id");

CREATE INDEX "worker_inbox_status_next_attempt_at_idx"
  ON "public"."worker_inbox"("status", "next_attempt_at");

CREATE INDEX "worker_inbox_status_locked_at_idx"
  ON "public"."worker_inbox"("status", "locked_at");
