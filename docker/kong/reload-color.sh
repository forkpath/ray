#!/bin/sh
set -eu

color="${1:-}"
case "$color" in
  blue|green) ;;
  *) echo "color must be blue or green" >&2; exit 64 ;;
esac

template="/etc/kong/kong.yml.template"
output="/etc/kong/kong.yml"
candidate="${output}.${color}.candidate"

: "${DOMAIN:=localhost}"
: "${ACME_EMAIL:=admin@${DOMAIN}}"
: "${REDIS_PASSWORD:=}"

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[\\&|]/\\&/g'
}

domain_escaped="$(escape_sed_replacement "$DOMAIN")"
acme_email_escaped="$(escape_sed_replacement "$ACME_EMAIL")"
redis_password_escaped="$(escape_sed_replacement "$REDIS_PASSWORD")"

sed \
  -e "s|\${DOMAIN}|${domain_escaped}|g" \
  -e "s|\${ACME_EMAIL}|${acme_email_escaped}|g" \
  -e "s|\${REDIS_PASSWORD}|${redis_password_escaped}|g" \
  -e "s|\${RAY_ACTIVE_COLOR}|${color}|g" \
  "$template" > "$candidate"

kong config parse "$candidate" >/dev/null
mv "$candidate" "$output"
kong reload
