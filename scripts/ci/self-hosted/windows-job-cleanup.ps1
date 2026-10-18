# Job hook for self-hosted Windows runners (ACTIONS_RUNNER_HOOK_JOB_STARTED and
# ACTIONS_RUNNER_HOOK_JOB_COMPLETED). Runs before and after every job, including
# after a cancelled job. It stops processes started from the runner work directory or
# from the test runners' temporary workspaces (Electron, Node, installed test apps), so
# files and ports are released, then removes what a killed desktop test leaves behind:
# %TEMP%\ray-* workspaces, ray-update-test-* updater caches, uninstall entries and
# shortcuts. It acts only on the runner account's own processes, files and registry.
# An administrator installs it into a directory the runner account cannot modify
# (docs/development/self-hosted-runners.md), so a repository change cannot silently
# alter what runs on the machine.
$ErrorActionPreference = 'SilentlyContinue'

# The runner exposes RUNNER_TEMP (<runner>\_work\_temp) to job hooks; its parent is the
# work directory. RAY_RUNNER_WORK_DIR overrides it.
$workDir = $env:RAY_RUNNER_WORK_DIR
if (-not $workDir -and $env:RUNNER_TEMP) { $workDir = Split-Path -Parent $env:RUNNER_TEMP }
if (-not $workDir -or -not (Test-Path -LiteralPath $workDir)) {
  Write-Warning 'windows-job-cleanup: runner work directory not found; set RAY_RUNNER_WORK_DIR. Skipping process cleanup.'
  $workDir = $null
}

# Test runners create their workspaces under %TEMP%\ray-*; installed test apps run from there.
$patterns = @()
if ($workDir) { $patterns += [Regex]::Escape($workDir.TrimEnd('\') + '\') }
if ($env:TEMP) { $patterns += [Regex]::Escape($env:TEMP.TrimEnd('\') + '\ray-') }
foreach ($pattern in $patterns) {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.ProcessId -ne $PID -and
      (($_.CommandLine -match $pattern) -or ($_.ExecutablePath -match $pattern))
    } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
}

# No job is running while this hook runs, so every leftover is stale.
if ($env:TEMP -and (Test-Path -LiteralPath $env:TEMP)) {
  Get-ChildItem -LiteralPath $env:TEMP -Directory -Force |
    Where-Object { $_.Name -match '^ray-(smoke|update-e2e|e2e|mobile)-' } |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
}

# The desktop update test installs per-user NSIS builds named ray-update-test-*. A killed
# run leaves their updater cache, uninstall entry and shortcuts behind.
if ($env:LOCALAPPDATA) {
  Get-ChildItem -LiteralPath $env:LOCALAPPDATA -Directory -Filter 'ray-update-test-*' -Force |
    ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }
}
$uninstall = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
if ($env:TEMP -and (Test-Path $uninstall)) {
  $tempPrefix = $env:TEMP.TrimEnd('\') + '\ray-'
  Get-ChildItem $uninstall |
    Where-Object { "$((Get-ItemProperty $_.PSPath).InstallLocation)".StartsWith($tempPrefix, 'OrdinalIgnoreCase') } |
    ForEach-Object { Remove-Item $_.PSPath -Recurse -Force }
}
foreach ($folder in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
  if ($folder -and (Test-Path -LiteralPath $folder)) {
    Get-ChildItem -LiteralPath $folder -Filter 'ray-update-test-*.lnk' -Force |
      ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force }
  }
}

# A job runs as this account and could plant configuration that later jobs load
# implicitly. The runner account never needs a user-level .npmrc, so its presence is
# reported as a failure for an administrator to inspect.
$npmrc = Join-Path $env:USERPROFILE '.npmrc'
if (Test-Path -LiteralPath $npmrc) {
  Write-Error "windows-job-cleanup: unexpected $npmrc; inspect and remove it before running more jobs."
  exit 1
}

exit 0
