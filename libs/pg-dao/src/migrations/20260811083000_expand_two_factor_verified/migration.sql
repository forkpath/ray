-- Close the historical Better Auth schema gap without changing legacy rows.
-- The field remains nullable and the default matches auth.prisma.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "public"."twoFactor"
    ADD COLUMN "verified" BOOLEAN DEFAULT true;

COMMIT;
