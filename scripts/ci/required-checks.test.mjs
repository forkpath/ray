import assert from 'node:assert/strict'
import { test } from 'node:test'

import { verifyRequiredChecks } from './required-checks.mjs'

function successfulRun() {
  return {
    select: {
      result: 'success',
      outputs: {
        backendEnabled: 'true',
        generator: 'true',
        bootstrap: 'false',
        extension: 'false',
        web: 'true',
        mobileAndroid: 'false',
        desktop: 'false'
      }
    },
    security: { result: 'success' },
    main: { result: 'success' },
    'database-contract': { result: 'success' },
    backend: { result: 'success' },
    generator: { result: 'success' },
    bootstrap: { result: 'skipped' },
    extension: { result: 'skipped' },
    web: { result: 'success' },
    mobile: { result: 'skipped' },
    'desktop-checks': { result: 'skipped' }
  }
}

test('only deliberately unselected suites may be skipped', () => {
  verifyRequiredChecks(successfulRun())
  for (const result of ['failure', 'cancelled', 'skipped', undefined]) {
    const run = successfulRun()
    run.backend.result = result
    assert.throws(() => verifyRequiredChecks(run), /backend/)
  }
})

test('missing selection data and failed prerequisites fail closed', () => {
  const run = successfulRun()
  delete run.select.outputs.mobileAndroid
  assert.throws(() => verifyRequiredChecks(run), /mobileAndroid/)
  for (const id of ['select', 'security', 'main', 'database-contract']) {
    const failed = successfulRun()
    failed[id].result = 'failure'
    assert.throws(() => verifyRequiredChecks(failed), new RegExp(id))
  }
})

test('a selected generator acceptance failure cannot be hidden by the other green jobs', () => {
  for (const result of ['failure', 'skipped', 'cancelled', undefined]) {
    const run = successfulRun()
    run.generator.result = result
    assert.throws(() => verifyRequiredChecks(run), /generator/)
  }
})

test('a selected bootstrap acceptance must succeed and an unselected one must be skipped', () => {
  const selected = successfulRun()
  selected.select.outputs.bootstrap = 'true'
  for (const result of ['failure', 'skipped', 'cancelled', undefined]) {
    selected.bootstrap.result = result
    assert.throws(() => verifyRequiredChecks(selected), /bootstrap/)
  }
  selected.bootstrap.result = 'success'
  verifyRequiredChecks(selected)

  const unselected = successfulRun()
  unselected.bootstrap.result = 'success'
  assert.throws(() => verifyRequiredChecks(unselected), /bootstrap: expected skipped/)
})
