# Job hook for self-hosted Windows runners (ACTIONS_RUNNER_HOOK_JOB_STARTED and
# ACTIONS_RUNNER_HOOK_JOB_COMPLETED). Runs before and after every job, including
# after a cancelled job, and stops processes started from the runner work
# directory (Electron, Node, dev servers) so files and ports are released.
# An administrator installs it into a directory the runner account cannot modify
# (docs/development/self-hosted-runners.md), so a repository change cannot silently
# alter what runs on the machine.
$ErrorActionPreference = 'SilentlyContinue'

# The runner exposes RUNNER_TEMP (<runner>\_work\_temp) to job hooks; its parent is the
# work directory. RAY_RUNNER_WORK_DIR overrides it.
$workDir = $env:RAY_RUNNER_WORK_DIR
if (-not $workDir -and $env:RUNNER_TEMP) { $workDir = Split-Path -Parent $env:RUNNER_TEMP }
if (-not $workDir -or -not (Test-Path -LiteralPath $workDir)) {
  Write-Warning 'windows-job-cleanup: runner work directory not found; set RAY_RUNNER_WORK_DIR. Skipping cleanup.'
  exit 0
}
$pattern = [Regex]::Escape($workDir.TrimEnd('\') + '\')

Get-CimInstance Win32_Process |
  Where-Object {
    $_.ProcessId -ne $PID -and
    (($_.CommandLine -match $pattern) -or ($_.ExecutablePath -match $pattern))
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

exit 0
