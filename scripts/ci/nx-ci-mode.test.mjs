import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { hasValidCommitRange, resolveNxCiMode } from './nx-ci-mode.mjs'

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
})
