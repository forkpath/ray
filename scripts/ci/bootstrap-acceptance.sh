#!/usr/bin/env bash
# Fresh-checkout acceptance for `pnpm bootstrap` on the current OS: create .env,
# install, start infra, migrate, seed, start all four apps, pass the running
# doctor, rerun bootstrap without changing .env, then shut down on SIGTERM.
# Run only in a disposable checkout; it refuses to touch an existing .env.
set -euo pipefail

cd "$(dirname "$0")/../.."
report_dir=${1:-dist/test-results/bootstrap}
ready_timeout=${BOOTSTRAP_READY_TIMEOUT:-1200}
mkdir -p "$report_dir"
log="$report_dir/bootstrap.log"

if [[ -e .env ]]; then
  echo 'Refusing to run: .env already exists. Use a fresh checkout.' >&2
  exit 1
fi

started=$(date +%s)
node scripts/development/bootstrap.mjs --seed --start >"$log" 2>&1 &
pid=$!

stop_bootstrap() {
  if kill -0 "$pid" 2>/dev/null; then
    kill -TERM "$pid"
    wait "$pid" || true
  fi
}
trap stop_bootstrap EXIT

deadline=$((started + ready_timeout))
until grep -q '^Full stack ready' "$log"; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo 'bootstrap exited before the stack became ready' >&2
    tail -n 80 "$log" >&2
    exit 1
  fi
  if (($(date +%s) > deadline)); then
    echo "stack not ready within ${ready_timeout}s" >&2
    tail -n 80 "$log" >&2
    exit 1
  fi
  sleep 5
done
ready_seconds=$(($(date +%s) - started))
echo "Full stack ready in ${ready_seconds}s"

node scripts/development/doctor.mjs --running | tee "$report_dir/doctor.log"

# A second run must preserve the generated configuration and reapply seed safely.
env_hash=$(node -e "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('.env')).digest('hex'))")
node scripts/development/bootstrap.mjs --seed >"$report_dir/rerun.log" 2>&1
grep -q 'Preserved existing .env' "$report_dir/rerun.log"
rerun_hash=$(node -e "process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync('.env')).digest('hex'))")
if [[ "$env_hash" != "$rerun_hash" ]]; then
  echo 'Rerunning bootstrap modified .env' >&2
  exit 1
fi

trap - EXIT
kill -TERM "$pid"
status=0
wait "$pid" || status=$?
# bootstrap reports a requested shutdown as 130 after stopping its children.
if [[ "$status" != 130 ]]; then
  echo "bootstrap shutdown exited with $status, expected 130" >&2
  tail -n 40 "$log" >&2
  exit 1
fi

printf '{"os":"%s","arch":"%s","readySeconds":%s,"totalSeconds":%s,"passed":true}\n' \
  "$(uname -s)" "$(uname -m)" "$ready_seconds" "$(($(date +%s) - started))" >"$report_dir/run.json"
cat "$report_dir/run.json"
