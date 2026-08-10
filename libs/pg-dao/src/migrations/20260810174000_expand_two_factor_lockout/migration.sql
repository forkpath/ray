-- Better Auth 1.6.22+ reads and writes these optional lockout fields.
-- Keep the change additive so Better Auth 1.6.2 remains compatible during rollout.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "public"."twoFactor"
    ADD COLUMN "failed_verification_count" INTEGER DEFAULT 0,
    ADD COLUMN "locked_until" TIMESTAMP(3);

COMMIT;
