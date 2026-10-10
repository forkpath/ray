#!/usr/bin/env bash
# Job hook for self-hosted macOS runners (ACTIONS_RUNNER_HOOK_JOB_STARTED and
# ACTIONS_RUNNER_HOOK_JOB_COMPLETED). Runs before and after every job, including
# after a job that was cancelled or whose runner process was killed, and removes
# what CI leaves behind:
#   - processes started from the runner work directory (Metro, Maestro's JVM,
#     Electron, Gradle daemons, dev servers);
#   - simulators created by scripts/testing/run-mobile.mjs (named ray-e2e-*).
# It never touches simulators or processes outside those patterns, so a machine
# can keep its owner's own devices. An administrator installs it into a directory
# the runner account cannot modify (docs/development/self-hosted-runners.md), so a
# repository change cannot silently alter what runs on the machine.
set -u

# The runner exposes RUNNER_TEMP (<runner>/_work/_temp) to job hooks; its parent is the
# work directory. RAY_RUNNER_WORK_DIR overrides it.
work_dir="${RAY_RUNNER_WORK_DIR:-}"
if [[ -z "$work_dir" && -n "${RUNNER_TEMP:-}" ]]; then
  work_dir="$(dirname "$RUNNER_TEMP")"
fi
if [[ -z "$work_dir" || ! -d "$work_dir" ]]; then
  echo "macos-job-cleanup: runner work directory not found; set RAY_RUNNER_WORK_DIR. Skipping process cleanup." >&2
  work_dir=""
fi

if [[ -n "$work_dir" ]]; then
  # Match on the full command line; skip this hook and its parent.
  for signal in TERM KILL; do
    pgrep -u "$(id -u)" -f "$work_dir/" | while read -r pid; do
      if [[ "$pid" != "$$" && "$pid" != "$PPID" ]]; then
        kill "-$signal" "$pid" 2>/dev/null || true
      fi
    done
    [[ "$signal" == TERM ]] && sleep 2
  done
fi

if command -v xcrun >/dev/null 2>&1; then
  xcrun simctl list devices 2>/dev/null |
    sed -nE 's/^[[:space:]]*ray-e2e-[^ ]+ \(([0-9A-F-]{36})\).*/\1/p' |
    while read -r udid; do
      xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
      xcrun simctl delete "$udid" >/dev/null 2>&1 || true
    done
fi

exit 0
