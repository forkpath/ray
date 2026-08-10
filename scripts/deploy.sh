#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yml"

APP_SERVICES=(engine web)

cd "$PROJECT_ROOT"

# ── Helpers ──────────────────────────────────────────────────────
info()  { printf '\033[1;34m[INFO]\033[0m  %s\n' "$*"; }
ok()    { printf '\033[1;32m[OK]\033[0m    %s\n' "$*"; }
err()   { printf '\033[1;31m[ERR]\033[0m   %s\n' "$*" >&2; }

ENV_FILE="$PROJECT_ROOT/.env"

dc() {
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") [command]

Commands:
  update    Pull latest code, rebuild app images, restart app services (default)
  build     Build app images only (engine + web)
  up        Start all services (infra is untouched if already running)
  restart   Restart app services only (engine + web)
  down      Stop all services
  logs      Tail logs (pass service name as extra arg, default: engine web)
  status    Show running containers
  migrate   Run Prisma migrations on engine
  infra     Start infrastructure only (redis, postgres, mongo, rabbitmq)

Only 'engine' and 'web' are rebuilt/restarted during updates.
Infrastructure containers (redis, postgres, mongo, rabbitmq, kong, konga)
are never rebuilt or restarted unless you explicitly run 'down' + 'up'.

Examples:
  ./deploy.sh                 # full update cycle (app only)
  ./deploy.sh build           # rebuild app images only
  ./deploy.sh logs engine     # tail engine logs
  ./deploy.sh infra           # start infrastructure (first deploy)
EOF
}

check_env() {
  if [ ! -f "$ENV_FILE" ]; then
    err ".env file not found at $ENV_FILE"
    info "Copy from template: cp $PROJECT_ROOT/.env.example $ENV_FILE"
    exit 1
  fi
}

# ── Commands ─────────────────────────────────────────────────────
sync_vite_env() {
  if [ ! -f "$ENV_FILE" ]; then return; fi

  info "Syncing VITE_* variables from $ENV_FILE"
  local ext_env="$PROJECT_ROOT/apps/extension/.env"

  # Extract VITE_* lines into apps/extension/.env so wxt prepare can resolve them
  grep -E '^VITE_[A-Za-z0-9_]+=' "$ENV_FILE" > "$ext_env" 2>/dev/null || true

  # Also export into current shell for Nx build
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*#|^[[:space:]]*$ ]] && continue
    if [[ "$line" =~ ^(VITE_[A-Za-z0-9_]+)=(.*) ]]; then
      export "${BASH_REMATCH[1]}=${BASH_REMATCH[2]}"
    fi
  done < "$ENV_FILE"
}

cmd_install() {
  local hash_file="node_modules/.lockfile-hash"
  local current_hash
  current_hash=$(sha256sum pnpm-lock.yaml 2>/dev/null | cut -d' ' -f1)

  if [ -d "node_modules" ] && [ -f "$hash_file" ] && [ "$(cat "$hash_file")" = "$current_hash" ]; then
    info "Dependencies up to date (lockfile unchanged), skipping install"
    return
  fi

  info "Installing dependencies..."
  pnpm install --frozen-lockfile
  echo "$current_hash" > "$hash_file"
}

cmd_nx_build() {
  # Sync VITE_* env BEFORE install — wxt prepare (postinstall) needs them to resolve manifest URLs
  sync_vite_env

  cmd_install

  if [ -n "${VITE_SENTRY_DSN:-}" ]; then
    info "Web client build: VITE_MONITORING_PROVIDER=${VITE_MONITORING_PROVIDER:-<unset>}, VITE_SENTRY_DSN is set (${#VITE_SENTRY_DSN} chars)"
  else
    info "Web client build: VITE_SENTRY_DSN is empty — Sentry will not be inlined into the browser bundle (check $ENV_FILE and sync_vite_env)"
  fi

  info "Building web + engine in parallel..."
  NODE_ENV=production pnpm exec nx run-many --targets=build --projects=web,engine --parallel=2

  info "Packaging engine deployment artifacts..."
  pnpm exec nx run engine:package

  # TanStack Start (Vinxi) always outputs to {projectRoot}/.output/ regardless
  # of any nitro() plugin config. Move it to dist/apps/web/ for consistency
  # with engine's dist/services/engine/ layout.
  if [ -d "apps/web/.output" ]; then
    info "Moving web build output to dist/apps/web/..."
    rm -rf dist/apps/web
    mv apps/web/.output dist/apps/web
  fi

  # Validate build outputs exist before Docker packaging
  local failed=0
  if [ ! -f "dist/apps/web/server/index.mjs" ]; then
    err "Web build output not found at dist/apps/web/server/index.mjs"
    failed=1
  fi
  if [ ! -f "dist/services/engine/main.js" ]; then
    err "Engine build output not found at dist/services/engine/main.js"
    failed=1
  fi
  [ "$failed" -eq 1 ] && exit 1

  ok "Nx builds complete"
}

cmd_build() {
  check_env
  cmd_nx_build
  info "Packaging app images (engine, web)..."
  dc build --parallel "$@" "${APP_SERVICES[@]}"
  ok "Images built successfully"
}

cmd_infra() {
  check_env
  info "Starting infrastructure services..."
  dc up -d redis postgres mongo rabbitmq
  ok "Infrastructure started"
  dc ps
}

cmd_up() {
  check_env
  info "Starting all services..."
  dc up -d
  ok "All services started"
  cmd_status
}

cmd_restart() {
  check_env
  info "Restarting app services (engine, web)..."
  dc up -d --no-deps --force-recreate "${APP_SERVICES[@]}"
  info "Waiting for app health checks..."
  dc up -d kong konga
  ok "App services restarted"
  cmd_status
}

cmd_down() {
  info "Stopping all services..."
  dc down
  ok "Services stopped (volumes preserved)"
}

cmd_update() {
  check_env

  info "Pulling latest code..."
  git pull --ff-only

  cmd_build

  info "Restarting app services only..."
  dc up -d --no-deps --force-recreate "${APP_SERVICES[@]}"
  info "Ensuring gateway is up..."
  dc up -d kong konga
  ok "Update complete"
  cmd_status
}

cmd_logs() {
  local service="${1:-}"
  if [ -n "$service" ]; then
    dc logs -f "$service"
  else
    dc logs -f "${APP_SERVICES[@]}"
  fi
}

cmd_status() {
  dc ps
}

cmd_migrate() {
  info "Running Prisma migrations..."
  dc exec engine npx prisma migrate deploy
  ok "Migrations complete"
}

# ── Main ─────────────────────────────────────────────────────────
COMMAND="${1:-update}"
shift 2>/dev/null || true

case "$COMMAND" in
  update)   cmd_update ;;
  build)    cmd_build "$@" ;;
  up)       cmd_up ;;
  restart)  cmd_restart ;;
  down)     cmd_down ;;
  infra)    cmd_infra ;;
  logs)     cmd_logs "$@" ;;
  status)   cmd_status ;;
  migrate)  cmd_migrate ;;
  -h|--help|help) usage ;;
  *)
    err "Unknown command: $COMMAND"
    usage
    exit 1
    ;;
esac
