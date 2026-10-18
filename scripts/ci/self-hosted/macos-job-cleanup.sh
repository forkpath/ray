#!/usr/bin/env bash
# Job hook for self-hosted macOS runners (ACTIONS_RUNNER_HOOK_JOB_STARTED and
# ACTIONS_RUNNER_HOOK_JOB_COMPLETED). Runs before and after every job, including
# after a job that was cancelled or whose runner process was killed, and removes
# what CI leaves behind:
#   - processes started from the runner work directory or from the test runners'
#     temporary workspaces (Metro, Maestro and its iOS driver, Electron, Gradle and
#     Kotlin daemons, dev servers), and Android emulators started from ANDROID_HOME;
#   - simulators created by scripts/testing/run-mobile.mjs (named ray-e2e-*);
#   - temporary workspaces of the mobile and desktop test runners (ray-* in the
#     temporary directory) and desktop update-test caches (ray-update-test-*).
# It acts only on the runner account's own processes and files and never touches
# simulators outside those patterns. The adb server on port 5037 is shared by every
# account on the machine, so it is left running.
#
# It also fails the job when the account holds configuration that build tools load
# implicitly (Gradle init scripts and properties, a user .npmrc): the runner account
# never needs them, so their presence means a job planted them.
#
# An administrator installs it into a directory the runner account cannot modify
# (docs/development/self-hosted-runners.md), so a repository change cannot silently
# alter what runs on the machine.
set -u
uid="$(id -u)"

kill_matching() {
  # Match on the full command line; skip this hook and its parent.
  local pattern="$1"
  for signal in TERM KILL; do
    pgrep -u "$uid" -f -- "$pattern" | while read -r pid; do
      if [[ "$pid" != "$$" && "$pid" != "$PPID" ]]; then
        kill "-$signal" "$pid" 2>/dev/null || true
      fi
    done
    [[ "$signal" == TERM ]] && sleep 2
  done
}

# The runner exposes RUNNER_TEMP (<runner>/_work/_temp) to job hooks; its parent is the
# work directory. RAY_RUNNER_WORK_DIR overrides it.
work_dir="${RAY_RUNNER_WORK_DIR:-}"
if [[ -z "$work_dir" && -n "${RUNNER_TEMP:-}" ]]; then
  work_dir="$(dirname "$RUNNER_TEMP")"
fi
if [[ -z "$work_dir" || ! -d "$work_dir" ]]; then
  echo "macos-job-cleanup: runner work directory not found; set RAY_RUNNER_WORK_DIR. Skipping work directory processes." >&2
  work_dir=""
fi

# Node uses TMPDIR when set and /tmp otherwise; launchd does not always set TMPDIR.
temp_dirs=(/tmp /private/tmp)
[[ -n "${TMPDIR:-}" ]] && temp_dirs+=("${TMPDIR%/}")
user_temp="$(getconf DARWIN_USER_TEMP_DIR 2>/dev/null)"
[[ -n "$user_temp" ]] && temp_dirs+=("${user_temp%/}")

[[ -n "$work_dir" ]] && kill_matching "$work_dir/"
for dir in "${temp_dirs[@]}"; do kill_matching "$dir/ray-"; done
# Emulators (qemu, crashpad) run from the SDK, which only CI uses in this account.
[[ -n "${ANDROID_HOME:-}" ]] && kill_matching "${ANDROID_HOME%/}/emulator/"
kill_matching '-avd ray-e2e-'
# Kotlin and Gradle daemons outlive a --no-daemon build and hold gigabytes of memory.
kill_matching 'KotlinCompileDaemon|GradleDaemon'
# Maestro's iOS driver runs as an xcodebuild test session.
kill_matching 'xcodebuild .*test-without-building'

if command -v xcrun >/dev/null 2>&1; then
  xcrun simctl list devices 2>/dev/null |
    sed -nE 's/^[[:space:]]*ray-e2e-[^ ]+ \(([0-9A-F-]{36})\).*/\1/p' |
    while read -r udid; do
      xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
      xcrun simctl delete "$udid" >/dev/null 2>&1 || true
    done
fi

# No job is running while this hook runs, so every leftover workspace is stale.
for dir in "${temp_dirs[@]}"; do
  [[ -d "$dir" ]] || continue
  find "$dir" -mindepth 1 -maxdepth 1 -user "$uid" \
    \( -name 'ray-mobile-*' -o -name 'ray-smoke-*' -o -name 'ray-update-e2e-*' -o -name 'ray-e2e-*' \) \
    -exec rm -rf {} + 2>/dev/null || true
done
find "$HOME/Library/Caches" -mindepth 1 -maxdepth 1 -name 'ray-update-test-*' -exec rm -rf {} + 2>/dev/null || true

planted=()
[[ -d "$HOME/.gradle/init.d" && -n "$(ls -A "$HOME/.gradle/init.d" 2>/dev/null)" ]] && planted+=("$HOME/.gradle/init.d")
for file in "$HOME/.gradle/init.gradle" "$HOME/.gradle/init.gradle.kts" "$HOME/.gradle/gradle.properties" "$HOME/.npmrc"; do
  [[ -e "$file" ]] && planted+=("$file")
done
if (( ${#planted[@]} > 0 )); then
  echo "macos-job-cleanup: unexpected configuration in the runner account: ${planted[*]}" >&2
  echo "Inspect and remove it before running more jobs." >&2
  exit 1
fi

exit 0
