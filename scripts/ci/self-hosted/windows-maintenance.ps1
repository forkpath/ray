# Weekly maintenance for a self-hosted Windows runner account.
#
# Run it as the dedicated runner user (scheduled by Task Scheduler, see
# docs/development/self-hosted-runners.md). It only removes regenerable files:
#   - the runner's temporary directory and diagnostic logs older than 14 days;
#   - the user's temporary files older than 7 days;
#   - the pnpm content store, when pnpm is on PATH.
# Tool versions under _work\_tool are kept. Nothing runs while a job is in progress.
#
# Usage: windows-maintenance.ps1 [-DryRun]
# Refuses to run unless the current user is RAY_RUNNER_USER (default ghrunner) and
# RAY_RUNNER_DIR (default C:\actions-runner) holds a configured runner.
param([switch]$DryRun)
$ErrorActionPreference = 'Continue'

$runnerDir = $env:RAY_RUNNER_DIR
if (-not $runnerDir) { $runnerDir = 'C:\actions-runner' }
$runnerUser = $env:RAY_RUNNER_USER
if (-not $runnerUser) { $runnerUser = 'ghrunner' }

# Only act inside the dedicated runner account; never on a personal account by mistake.
if ($env:USERNAME -ne $runnerUser -or -not (Test-Path -LiteralPath (Join-Path $runnerDir '.runner'))) {
  Write-Error "Not the runner account ($runnerUser with a configured runner in $runnerDir); nothing done."
  exit 1
}

function Remove-Paths($paths) {
  foreach ($path in $paths) {
    if ($DryRun) { Write-Output "[dry-run] remove $path" }
    else { Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

# Runner.Worker exists only while a job runs.
if (Get-Process -Name 'Runner.Worker' -ErrorAction SilentlyContinue) {
  Write-Output 'A job is running; skipping maintenance.'
  exit 0
}

$drive = (Get-Item $runnerDir -ErrorAction SilentlyContinue).PSDrive
if ($drive) { Write-Output ("Free space before: {0:N1} GB" -f ($drive.Free / 1GB)) }

$temp = Join-Path $runnerDir '_work\_temp'
if (Test-Path -LiteralPath $temp) { Remove-Paths @($temp) }

$diag = Join-Path $runnerDir '_diag'
if (Test-Path -LiteralPath $diag) {
  Remove-Paths (Get-ChildItem -LiteralPath $diag -File | Where-Object LastWriteTime -lt (Get-Date).AddDays(-14)).FullName
}

Remove-Paths (Get-ChildItem -LiteralPath $env:TEMP -Force -ErrorAction SilentlyContinue |
  Where-Object LastWriteTime -lt (Get-Date).AddDays(-7)).FullName

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
  if ($DryRun) { Write-Output '[dry-run] pnpm store prune' } else { pnpm store prune }
}

if ($drive) { Write-Output ("Free space after: {0:N1} GB" -f ((Get-PSDrive $drive.Name).Free / 1GB)) }
exit 0
