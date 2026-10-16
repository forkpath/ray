import assert from 'node:assert/strict'
import { test } from 'node:test'

import { checkBranches } from './pr-policy.mjs'

test('pull requests may only target dev or arch', () => {
  for (const base of ['dev', 'arch']) assert.deepEqual(checkBranches({ base }), [])
  for (const base of ['feature/login', 'release', 'Dev']) {
    assert.match(checkBranches({ base })[0], /must target dev or arch/)
  }
})

test('main never accepts pull requests; it is released by fast-forward', () => {
  assert.match(checkBranches({ base: 'main' })[0], /does not accept pull requests.*fast-forwarding/)
})
