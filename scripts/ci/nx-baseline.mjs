export function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function invariant(condition, message) {
  if (!condition) throw new Error(`invalid Nx baseline evidence: ${message}`)
}

export function buildNxBaselineSummary(reports, options = {}) {
  const expectedSamples = options.expectedSamples ?? 5
  invariant(Number.isInteger(expectedSamples) && expectedSamples >= 3, 'expected sample count must be at least 3')
  invariant(reports.length === expectedSamples, `expected ${expectedSamples} reports, received ${reports.length}`)

  const sampleIds = new Set()
  const shas = new Set()
  const runIds = new Set()
  const runAttempts = new Set()
  const durations = []

  for (const report of reports) {
    invariant(report?.schemaVersion === 1, 'every report must use schema version 1')
    invariant(report.phase === 'baseline', 'every report must use the baseline phase')
    invariant(report.exitCode === 0, 'failed validation runs cannot define a baseline')
    invariant(Number.isFinite(report.durationMs) && report.durationMs > 0, 'every duration must be positive')
    invariant(report.nx?.cloudConfigured === false, 'Nx Cloud must be disabled for baseline samples')
    invariant(report.nx?.cloudDisabled === true, 'NX_NO_CLOUD must be enabled for baseline samples')
    invariant(report.execution?.runnerLabel === 'ubuntu-latest', 'every sample must use ubuntu-latest')
    invariant(report.execution?.runnerOs === 'Linux', 'every sample must run on Linux')
    invariant(typeof report.execution?.sampleId === 'string', 'every sample must have an identity')
    invariant(
      typeof report.github?.sha === 'string' && report.github.sha.length > 0,
      'every sample must record a Git SHA'
    )
    invariant(
      typeof report.github?.runId === 'string' && report.github.runId.length > 0,
      'every sample must record a workflow run'
    )
    invariant(
      typeof report.github?.runAttempt === 'string' && report.github.runAttempt.length > 0,
      'every sample must record a workflow attempt'
    )

    const deterministicTasks = (report.tasks ?? []).filter(task =>
      ['lint', 'typecheck', 'test', 'build'].includes(task.target)
    )
    invariant(deterministicTasks.length > 0, 'every report must contain deterministic tasks')
    invariant(
      deterministicTasks.every(task => task.status === 0),
      'every deterministic task must pass'
    )
    invariant(
      deterministicTasks.every(task => !task.cacheStatus?.endsWith('cache-hit')),
      'baseline samples must not contain local or remote Nx cache hits'
    )

    sampleIds.add(report.execution.sampleId)
    shas.add(report.github.sha)
    runIds.add(report.github.runId)
    runAttempts.add(report.github.runAttempt)
    durations.push(report.durationMs)
  }

  invariant(sampleIds.size === expectedSamples, 'sample identities must be unique')
  invariant(shas.size === 1, 'all samples must use the same Git SHA')
  invariant(runIds.size === 1, 'all samples must come from one workflow run')
  invariant(runAttempts.size === 1, 'all samples must come from one workflow attempt')

  const medianDurationMs = median(durations)
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    gitSha: [...shas][0],
    workflowRunId: [...runIds][0],
    workflowRunAttempt: [...runAttempts][0],
    method: {
      runner: 'ubuntu-latest',
      sampleCount: expectedSamples,
      nxCloud: false,
      nxCache: false,
      targets: ['lint', 'typecheck', 'test', 'build'],
      scope: 'all-projects'
    },
    samples: reports
      .map(report => ({
        sampleId: report.execution.sampleId,
        durationMs: report.durationMs,
        deterministicTasks: report.summary?.deterministicTasks ?? null
      }))
      .sort((left, right) => left.sampleId.localeCompare(right.sampleId)),
    medianDurationMs,
    repositoryVariable: {
      name: 'CI_BASELINE_MEDIAN_MS',
      value: String(Math.round(medianDurationMs))
    }
  }
}
