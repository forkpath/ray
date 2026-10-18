#!/usr/bin/env bash
# Weekly maintenance for a self-hosted macOS runner account.
#
# Run it as the dedicated runner user (scheduled by launchd, see
# docs/development/self-hosted-runners.md). It only removes regenerable caches
# owned by that user; nothing here is needed by a later job, which rebuilds or
# re-downloads what it uses:
#   - unavailable simulators (left over after a simulator runtime is removed);
#   - Xcode DerivedData, the CocoaPods download cache and Maestro's run logs;
#   - the CI cache directory (RAY_CI_CACHE_DIR, default ~/.cache/ray-ci) once it
#     grows past RAY_CI_CACHE_LIMIT_GB (default 20); the next job rebuilds it;
#   - the runner's temporary directory and diagnostic logs older than 14 days;
#   - unreferenced packages in the pnpm content store, when pnpm is on PATH.
# Gradle expires its own unused cache entries.
# Tool versions under _work/_tool, simulator runtimes and Xcode installs are kept.
# Nothing runs while a job is in progress.
#
# Usage: macos-maintenance.sh [--dry-run]
# Refuses to run unless the current user is RAY_RUNNER_USER (default ghrunner) and
# RAY_RUNNER_DIR (default ~/actions-runner) holds a configured runner.
set -u

dry_run=false
[[ "${1:-}" == "--dry-run" ]] && dry_run=true
run() {
  if $dry_run; then echo "[dry-run] $*"; else "$@"; fi
}

runner_dir="${RAY_RUNNER_DIR:-$HOME/actions-runner}"
runner_user="${RAY_RUNNER_USER:-ghrunner}"

# Only act inside the dedicated runner account; never on a personal account by mistake.
if [[ "$(id -un)" != "$runner_user" || ! -f "$runner_dir/.runner" ]]; then
  echo "Not the runner account ($runner_user with a configured runner in $runner_dir); nothing done." >&2
  exit 1
fi

# Runner.Worker exists only while a job runs.
if pgrep -u "$(id -u)" -f 'Runner.Worker' >/dev/null; then
  echo "A job is running; skipping maintenance."
  exit 0
fi

echo "Free space before: $(df -h "$HOME" | awk 'NR==2 {print $4}')"

if command -v xcrun >/dev/null 2>&1; then
  run xcrun simctl delete unavailable
fi

for dir in \
  "$HOME/Library/Developer/Xcode/DerivedData" \
  "$HOME/Library/Caches/CocoaPods" \
  "$HOME/.maestro/tests" \
  "$runner_dir/_work/_temp"; do
  if [[ -d "$dir" ]]; then run rm -rf "$dir"; fi
done

ci_cache="${RAY_CI_CACHE_DIR:-$HOME/.cache/ray-ci}"
limit_gb="${RAY_CI_CACHE_LIMIT_GB:-20}"
if [[ -d "$ci_cache" ]]; then
  used_gb=$(( $(du -sk "$ci_cache" | awk '{print $1}') / 1048576 ))
  echo "CI cache: ${used_gb} GB (limit ${limit_gb} GB)"
  if (( used_gb >= limit_gb )); then run rm -rf "$ci_cache"; fi
fi

if [[ -d "$runner_dir/_diag" ]]; then
  run find "$runner_dir/_diag" -type f -mtime +14 -delete
fi

if command -v pnpm >/dev/null 2>&1; then
  run pnpm store prune
fi

echo "Free space after: $(df -h "$HOME" | awk 'NR==2 {print $4}')"
exit 0
