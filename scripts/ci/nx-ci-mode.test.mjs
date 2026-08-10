import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { hasCiControlPlaneChange, hasValidCommitRange, resolveNxCiMode } from './nx-ci-mode.mjs'

const base = 'a'.repeat(40)
const head = 'b'.repeat(40)

function resolve(overrides = {}) {
  return resolveNxCiMode({
    eventName: 'pull_request',
    ref: 'refs/pull/42/merge',
    isForkPr: false,
    setShasOutcome: 'success',
    cloudProbeOutcome: 'success',
    base,
    head,
    commitRangeValid: true,
    ciControlPlaneChanged: false,
    ...overrides
  })
}

describe('Nx CI mode resolution', () => {
  it('uses affected for an internal PR with valid SHAs and Nx Cloud', () => {
    assert.deepEqual(resolve(), {
      mode: 'affected',
      base,
      head,
      disableCloud: false,
      reason: 'affected-ready'
    })
  })

  it('uses affected without Nx Cloud for fork PRs', () => {
    assert.deepEqual(resolve({ isForkPr: true, cloudProbeOutcome: 'skipped' }), {
      mode: 'affected',
      base,
      head,
      disableCloud: true,
      reason: 'fork-pr-no-cloud'
    })
  })

  it('falls back to a full run when SHA resolution is unsafe', () => {
    assert.equal(resolve({ setShasOutcome: 'failure' }).mode, 'full')
    assert.equal(resolve({ commitRangeValid: false }).reason, 'invalid-sha-range')
  })

  it('falls back to a local full run when Nx Cloud is unavailable', () => {
    assert.deepEqual(resolve({ cloudProbeOutcome: 'failure' }), {
      mode: 'full',
      base: '',
      head: '',
      disableCloud: true,
      reason: 'nx-cloud-unavailable'
    })
  })

  it('forces a full run for CI control-plane changes', () => {
    assert.deepEqual(resolve({ ciControlPlaneChanged: true }), {
      mode: 'full',
      base: '',
      head: '',
      disableCloud: false,
      reason: 'ci-control-plane-change'
    })
  })

  it('always runs main, tags, schedules and manual dispatches in full mode', () => {
    const fullEvents = [
      { eventName: 'push', ref: 'refs/heads/main' },
      { eventName: 'push', ref: 'refs/tags/v1.0.0' },
      { eventName: 'schedule', ref: 'refs/heads/main' },
      { eventName: 'workflow_dispatch', ref: 'refs/heads/main' }
    ]

    for (const event of fullEvents) {
      assert.equal(resolve(event).mode, 'full')
    }
  })

  it('accepts only existing ancestor commit ranges', () => {
    const calls = []
    const git = (_command, arguments_) => {
      calls.push(arguments_)
      return { status: 0 }
    }

    assert.equal(hasValidCommitRange(base, head, git), true)
    assert.deepEqual(calls.at(-1), ['merge-base', '--is-ancestor', base, head])
    assert.equal(hasValidCommitRange('not-a-sha', head, git), false)
  })

  it('recognizes global CI inputs and CI scripts as control-plane changes', () => {
    const git = (_command, arguments_) => {
      assert.deepEqual(arguments_, ['diff', '--name-only', '--diff-filter=ACMR', base, head])
      return {
        status: 0,
        stdout: 'apps/web/src/app.tsx\nscripts/ci/nx-ci-mode.mjs\n'
      }
    }

    assert.equal(hasCiControlPlaneChange(base, head, git), true)
  })

  it('keeps leaf-only source changes eligible for affected execution', () => {
    const git = () => ({
      status: 0,
      stdout: 'apps/web/src/app.tsx\n'
    })

    assert.equal(hasCiControlPlaneChange(base, head, git), false)
  })
})
