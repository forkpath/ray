#!/bin/sh
set -e

TEMPLATE="/etc/kong/kong.yml.template"
OUTPUT="/etc/kong/kong.yml"

: "${DOMAIN:=localhost}"
: "${ACME_EMAIL:=admin@${DOMAIN}}"
: "${REDIS_PASSWORD:=}"
: "${RAY_ACTIVE_COLOR:?RAY_ACTIVE_COLOR is required}"

case "$RAY_ACTIVE_COLOR" in
  blue|green) ;;
  *) echo "RAY_ACTIVE_COLOR must be blue or green" >&2; exit 64 ;;
esac

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[\\&|]/\\&/g'
}

DOMAIN_ESCAPED="$(escape_sed_replacement "$DOMAIN")"
ACME_EMAIL_ESCAPED="$(escape_sed_replacement "$ACME_EMAIL")"
REDIS_PASSWORD_ESCAPED="$(escape_sed_replacement "$REDIS_PASSWORD")"

sed \
  -e "s|\${DOMAIN}|${DOMAIN_ESCAPED}|g" \
  -e "s|\${ACME_EMAIL}|${ACME_EMAIL_ESCAPED}|g" \
  -e "s|\${REDIS_PASSWORD}|${REDIS_PASSWORD_ESCAPED}|g" \
  -e "s|\${RAY_ACTIVE_COLOR}|${RAY_ACTIVE_COLOR}|g" \
  "$TEMPLATE" > "$OUTPUT"

exec /docker-entrypoint.sh kong docker-start
