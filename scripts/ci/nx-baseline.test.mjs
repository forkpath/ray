import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildNxBaselineSummary } from './nx-baseline.mjs'

function report(sampleId, durationMs, overrides = {}) {
  return {
    schemaVersion: 1,
    phase: 'baseline',
    durationMs,
    exitCode: 0,
    nx: { cloudConfigured: false, cloudDisabled: true },
    execution: {
      sampleId,
      runnerLabel: 'ubuntu-latest',
      runnerOs: 'Linux'
    },
    github: {
      sha: 'same-sha',
      runId: 'run-1',
      runAttempt: '1'
    },
    summary: { deterministicTasks: 2 },
    tasks: [
      { target: 'lint', status: 0, cacheStatus: 'cache-miss' },
      { target: 'build', status: 0, cacheStatus: 'not-cached' }
    ],
    ...overrides
  }
}

describe('Nx baseline evidence', () => {
  it('computes the median from five independent no-cache samples', () => {
    const summary = buildNxBaselineSummary([
      report('1', 500),
      report('2', 100),
      report('3', 300),
      report('4', 200),
      report('5', 400)
    ])

    assert.equal(summary.medianDurationMs, 300)
    assert.deepEqual(summary.repositoryVariable, {
      name: 'CI_BASELINE_MEDIAN_MS',
      value: '300'
    })
  })

  it('rejects a cache hit', () => {
    const reports = [1, 2, 3, 4, 5].map(value => report(String(value), value * 100))
    reports[2].tasks[0].cacheStatus = 'remote-cache-hit'
    assert.throws(() => buildNxBaselineSummary(reports), /must not contain local or remote Nx cache hits/)
  })

  it('rejects mixed SHAs and duplicate sample identities', () => {
    const mixed = [1, 2, 3, 4, 5].map(value => report(String(value), value * 100))
    mixed[4].github.sha = 'different-sha'
    assert.throws(() => buildNxBaselineSummary(mixed), /same Git SHA/)

    const duplicated = [1, 2, 3, 4, 4].map(value => report(String(value), value * 100))
    assert.throws(() => buildNxBaselineSummary(duplicated), /sample identities must be unique/)
  })
})
