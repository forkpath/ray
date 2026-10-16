import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { parse, stringify } from 'yaml'

import {
  applyPullRequestLabels,
  onlyDeploymentJobsChanged,
  requiresFullRun,
  selectTestSuites
} from './select-test-suites.mjs'

test('the CI native exemption requires unchanged shared configuration and all non-deployment jobs', () => {
  const before = readFileSync('.github/workflows/ci.yml', 'utf8')
  const deploymentChange = parse(before)
  deploymentChange.jobs['deploy-staging'].if = "always() && needs.required-checks.result == 'success'"
  deploymentChange.jobs['staging-deployment']['timeout-minutes'] = 6
  assert.equal(onlyDeploymentJobsChanged(before, stringify(deploymentChange)), true)

  for (const change of [
    workflow => {
      workflow.jobs.mobile.if = 'false'
    },
    workflow => {
      workflow.jobs.select.steps = []
    },
    workflow => {
      workflow.jobs.main.steps = []
    },
    workflow => {
      workflow.jobs['required-checks'].needs = []
    },
    workflow => {
      workflow.env = { CHANGED: 'true' }
    },
    workflow => {
      workflow.on.push.branches = ['main']
    },
    workflow => {
      workflow.permissions = { contents: 'write' }
    },
    workflow => {
      delete workflow.jobs.mobile
    },
    workflow => {
      delete workflow.jobs['deploy-staging']
    }
  ]) {
    const after = structuredClone(deploymentChange)
    change(after)
    assert.equal(onlyDeploymentJobsChanged(before, stringify(after)), false)
  }
  for (const invalid of ['', 'jobs: [', 'jobs: []', 'null', 'jobs: {mobile: true}']) {
    assert.equal(onlyDeploymentJobsChanged(before, invalid), false)
    assert.equal(onlyDeploymentJobsChanged(invalid, before), false)
  }
})

test('deployment-only CI edits retain full quality gates and use the remaining changed files for native selection', () => {
  const input = {
    affected: ['mobile', 'engine', 'pulse', 'worker'],
    nativeAffected: [],
    files: ['.github/workflows/ci.yml', 'scripts/ci/select-test-suites.mjs', 'scripts/ci/promotion.test.mjs'],
    ciDeploymentOnly: true,
    full: false
  }
  const result = selectTestSuites(input)
  assert.equal(result.full, true)
  assert.deepEqual(result.backend, ['engine', 'pulse', 'worker'])
  assert.equal(result.web && result.desktop && result.extension && result.generator, true)
  assert.equal(result.mobileAndroid || result.mobileIos, false)
  const js = selectTestSuites({
    ...input,
    nativeAffected: ['mobile'],
    files: [...input.files, 'apps/mobile/src/app/index.tsx']
  })
  assert.equal(js.mobileAndroid, true)
  assert.equal(js.mobileIos, false)
  for (const file of ['pnpm-lock.yaml', 'apps/mobile/app.config.ts', 'scripts/testing/run-mobile.mjs']) {
    const changed = selectTestSuites({ ...input, files: [...input.files, file] })
    assert.equal(changed.mobileAndroid && changed.mobileIos, true)
  }
  for (const change of [{ ciDeploymentOnly: false }, { full: true }]) {
    const changed = selectTestSuites({ ...input, ...change })
    assert.equal(changed.mobileAndroid && changed.mobileIos, true)
  }
})

test('pull requests use affected selection; dev pushes, initial, scheduled and explicit runs are full', () => {
  const input = { eventName: 'pull_request', ref: 'refs/pull/1/merge', base: 'a'.repeat(40), force: '' }
  assert.equal(requiresFullRun(input), false)
  // arch pushes never run CI (no push trigger); other branch pushes are not full either.
  assert.equal(requiresFullRun({ ...input, eventName: 'push', ref: 'refs/heads/feature' }), false)
  // main is fast-forwarded to an already tested dev commit; CI does not run there.
  assert.equal(requiresFullRun({ ...input, eventName: 'push', ref: 'refs/heads/main' }), false)
  for (const change of [
    { eventName: 'push', ref: 'refs/heads/dev' },
    { base: undefined },
    { base: '0'.repeat(40) },
    { eventName: 'schedule' },
    { eventName: 'workflow_dispatch' },
    { force: 'true' },
    { ref: 'refs/tags/v0.1.0' }
  ])
    assert.equal(requiresFullRun({ ...input, ...change }), true)
})

test('documentation-only changes select no device or service suites', () => {
  const result = selectTestSuites({ affected: [], files: ['docs/development/testing.md'], full: false })
  assert.deepEqual(result.backend, [])
  assert.equal(
    Object.values(result).some(value => value === true),
    false
  )
})

test('shared graph dependencies select their consuming backend services', () => {
  const result = selectTestSuites({
    affected: ['pg-dao', 'engine', 'pulse', 'worker'],
    files: ['libs/pg-dao/src/index.ts'],
    full: false
  })
  assert.deepEqual(result.backend, ['engine', 'pulse', 'worker'])
  assert.equal(result.mobileAndroid, false)
})

test('Mobile JS PRs run Android; native configuration changes run both platforms', () => {
  const input = { affected: ['mobile'], files: ['apps/mobile/src/app/index.tsx'], full: false }
  assert.equal(selectTestSuites(input).mobileAndroid, true)
  assert.equal(selectTestSuites(input).mobileIos, false)
  assert.equal(selectTestSuites({ ...input, files: ['apps/mobile/app.config.ts'] }).mobileIos, true)
})

test('shared harness and workflow changes cannot escape the full framework matrix', () => {
  for (const file of [
    'scripts/testing/run-backend.mjs',
    'scripts/ci/required-checks.mjs',
    'scripts/testing/backend-containers.mjs',
    'patches/react-native-ios-utilities@5.2.0.patch',
    '.github/workflows/ci.yml'
  ]) {
    const result = selectTestSuites({ affected: [], files: [file], full: false })
    assert.deepEqual(result.backend, ['engine', 'pulse', 'worker'])
    assert.equal(result.mobileIos, true)
    assert.equal(result.extension, true)
    assert.equal(result.desktop, true)
    assert.equal(result.full, true)
  }
})

test('release changes retain the quality and image gates without rebuilding unaffected device binaries', () => {
  for (const file of [
    '.github/workflows/deploy.yml',
    'docker/engine.Dockerfile',
    '.dockerignore',
    'scripts/release/publish-verified-images.mjs',
    'scripts/release/framework-smoke.mjs',
    'scripts/ci/framework-smoke.test.mjs',
    'scripts/ci/select-test-suites.mjs',
    'scripts/ci/select-test-suites.test.mjs'
  ]) {
    const result = selectTestSuites({ affected: [], files: [file], full: false })
    assert.equal(result.full, true)
    assert.deepEqual(result.backend, ['engine', 'pulse', 'worker'])
    assert.equal(result.web && result.extension && result.desktop && result.generator, true)
    assert.equal(result.mobileAndroid || result.mobileIos, false)
  }
})

test('release changes cannot suppress affected mobile code, native inputs, shared harnesses or explicit full runs', () => {
  const releaseFiles = [
    '.github/workflows/deploy.yml',
    'scripts/ci/select-test-suites.mjs',
    'scripts/ci/framework-smoke.test.mjs'
  ]
  const js = selectTestSuites({
    affected: ['mobile'],
    files: [...releaseFiles, 'libs/common/src/index.ts'],
    full: false
  })
  assert.equal(js.mobileAndroid, true)
  assert.equal(js.mobileIos, false)
  for (const file of [
    'apps/mobile/app.config.ts',
    'apps/mobile/plugins/with-example.ts',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'package.json',
    'scripts/testing/mobile-tools.json',
    'scripts/testing/run-mobile.mjs',
    'scripts/testing/process-tree.mjs',
    'scripts/ci/required-checks.mjs',
    '.github/workflows/ci.yml',
    '.github/actions/new-helper/action.yml',
    'patches/react-native-ios-utilities@5.2.0.patch'
  ]) {
    const result = selectTestSuites({ affected: [], files: [...releaseFiles, file], full: false })
    assert.equal(result.mobileAndroid && result.mobileIos, true, file)
  }
  const forced = selectTestSuites({ affected: [], files: releaseFiles, full: true })
  assert.equal(forced.mobileAndroid && forced.mobileIos, true)
})

test('scheduled/full validation selects every runtime without an affected set', () => {
  const result = selectTestSuites({ affected: [], files: [], full: true })
  assert.deepEqual(result.backend, ['engine', 'pulse', 'worker'])
  assert.equal(result.web && result.mobileIos && result.mobileAndroid && result.extension && result.desktop, true)
  assert.equal(result.generator, true)
})

test('generator changes run generated HTTP acceptance without selecting native devices', () => {
  const result = selectTestSuites({
    affected: ['ray-plugin'],
    files: ['tools/ray-plugin/src/generators/resource/generator.cjs'],
    full: false
  })
  assert.equal(result.generator, true)
  assert.equal(result.mobileAndroid || result.mobileIos || result.desktop, false)
})

test('environment-level setup changes run the fresh-checkout bootstrap acceptance without native devices', () => {
  for (const file of [
    'scripts/development/bootstrap.mjs',
    '.env.example',
    'package.json',
    'pnpm-lock.yaml',
    'nx.json',
    'libs/pg-dao/src/migrations/20260921000000_init/migration.sql',
    'libs/pg-dao/src/seed.ts'
  ]) {
    assert.equal(selectTestSuites({ affected: [], files: [file], full: false }).bootstrap, true, file)
  }
  const app = selectTestSuites({ affected: ['engine'], files: ['services/engine/src/main.ts'], full: false })
  assert.equal(app.bootstrap, false)
  assert.equal(selectTestSuites({ affected: [], files: [], full: true }).bootstrap, true)
  const setup = selectTestSuites({ affected: [], files: ['scripts/development/doctor.mjs'], full: false })
  assert.equal(setup.mobileAndroid || setup.mobileIos || setup.desktop, false)
})

test('pull request labels skip only the named device suites, and ci:full overrides them', () => {
  const all = selectTestSuites({ affected: [], files: [], full: true })
  const mobile = applyPullRequestLabels(all, ['CI:skip-mobile'])
  assert.equal(mobile.suites.mobileAndroid || mobile.suites.mobileIos, false)
  assert.equal(mobile.suites.desktop && mobile.suites.extension && mobile.suites.web, true)
  assert.deepEqual(mobile.suites.backend, ['engine', 'pulse', 'worker'])
  assert.deepEqual(
    mobile.skipped.map(item => item.suite),
    ['mobileAndroid', 'mobileIos']
  )
  const both = applyPullRequestLabels(all, ['ci:skip-desktop', 'ci:skip-extension', 'documentation'])
  assert.equal(both.suites.desktop || both.suites.extension, false)
  assert.equal(both.suites.mobileAndroid, true)
  const forced = applyPullRequestLabels(all, ['ci:skip-mobile', 'ci:full'])
  assert.deepEqual(forced, { suites: all, skipped: [] })
  // A skip label on an unselected suite reports nothing.
  const docs = selectTestSuites({ affected: [], files: ['docs/development/testing.md'], full: false })
  assert.deepEqual(applyPullRequestLabels(docs, ['ci:skip-mobile']).skipped, [])
})
