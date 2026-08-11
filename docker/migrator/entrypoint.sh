#!/bin/sh
set -eu

command_name="${1:-migrate}"
if [ "$#" -gt 0 ]; then
  shift
fi

case "$command_name" in
  migrate)
    exec /app/node_modules/.bin/prisma migrate deploy --config ./prisma.config.ts --schema ./src
    ;;
  online-migrate)
    exec node ./scripts/run-online-migrations.mjs "$@"
    ;;
  compatibility-check)
    exec /app/node_modules/.bin/prisma migrate status --config ./prisma.config.ts --schema ./src
    ;;
  billing-owner-backfill)
    exec node ./scripts/backfill-billing-owners.mjs "$@"
    ;;
  billing-contract-readiness)
    exec node ./scripts/check-billing-contract-readiness.mjs "$@"
    ;;
  *)
    echo "Unsupported migrator command: $command_name" >&2
    exit 64
    ;;
esac
