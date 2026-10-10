import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import { parse } from 'yaml'

import { HOSTED_RUNNERS, isTrustedForSelfHosted, readContext, resolveRunners } from './runners.mjs'

const root = resolve(import.meta.dirname, '../..')
const push = { eventName: 'push', actor: 'forkpath', repository: 'forkpath/postfly.io' }
const selfHosted = {
  RAY_RUNNER_IOS: '["self-hosted","macOS","ARM64","ray-ios"]',
  RAY_RUNNER_DESKTOP_MAC_ARM64: '["self-hosted","macOS","ARM64","ray-desktop-mac-arm64"]',
  RAY_RUNNER_DESKTOP_MAC_X64: '["self-hosted","macOS","X64","ray-desktop-mac-x64"]',
  RAY_RUNNER_DESKTOP_WIN: '["self-hosted","Windows","X64","ray-desktop-win"]'
}

test('without variables every role stays on its hosted image', () => {
  assert.deepEqual(resolveRunners({}, push), { trusted: true, runners: HOSTED_RUNNERS })
  assert.deepEqual(resolveRunners({ RAY_RUNNER_IOS: '  ' }, push).runners.ios, 'macos-26')
})

test('trusted events use the configured self-hosted labels', () => {
  const { runners } = resolveRunners(selfHosted, push)
  assert.deepEqual(runners.ios, ['self-hosted', 'macOS', 'ARM64', 'ray-ios'])
  assert.deepEqual(runners.desktopMacX64, ['self-hosted', 'macOS', 'X64', 'ray-desktop-mac-x64'])
  assert.deepEqual(runners.desktopWin, ['self-hosted', 'Windows', 'X64', 'ray-desktop-win'])
  for (const eventName of ['workflow_dispatch', 'schedule']) {
    assert.equal(resolveRunners(selfHosted, { ...push, eventName }).trusted, true)
  }
})

test('bots, fork pull requests and unknown events never reach self-hosted machines', () => {
  const samePr = { ...push, eventName: 'pull_request', headRepository: 'forkpath/postfly.io' }
  assert.equal(isTrustedForSelfHosted(samePr), true)
  for (const context of [
    { ...samePr, actor: 'dependabot[bot]' },
    { ...samePr, pullRequestAuthor: 'dependabot[bot]' },
    { ...push, actor: 'github-actions[bot]' },
    { ...samePr, headRepository: 'someone/postfly.io' },
    { ...samePr, headRepository: undefined },
    { ...push, eventName: 'pull_request_target' },
    { ...push, eventName: 'issue_comment' },
    { ...push, actor: undefined }
  ]) {
    const { trusted, runners } = resolveRunners(selfHosted, context)
    assert.equal(trusted, false, JSON.stringify(context))
    assert.deepEqual(runners, HOSTED_RUNNERS)
  }
})

test('malformed or mismatched labels fail closed, even for untrusted events', () => {
  const cases = [
    [{ RAY_RUNNER_IOS: 'ray-ios' }, /JSON array/],
    [{ RAY_RUNNER_IOS: '[]' }, /non-empty/],
    [{ RAY_RUNNER_IOS: '["self-hosted", 3]' }, /non-empty JSON array of label strings/],
    [{ RAY_RUNNER_IOS: '["macOS","ray-ios"]' }, /"self-hosted"/],
    [{ RAY_RUNNER_IOS: '["self-hosted","Linux"]' }, /"macOS"/],
    // An x64 desktop build must not land on an arm64 Mac (Rosetta) or vice versa.
    [{ RAY_RUNNER_DESKTOP_MAC_X64: '["self-hosted","macOS","ARM64"]' }, /"X64"/],
    [{ RAY_RUNNER_DESKTOP_MAC_ARM64: '["self-hosted","macOS","X64"]' }, /"ARM64"/],
    [{ RAY_RUNNER_DESKTOP_WIN: '["self-hosted","macOS","X64"]' }, /"Windows"/],
    [{ RAY_RUNNER_ANDROID: '["self-hosted","Linux","X64"]' }, /Android runs on hosted Linux/]
  ]
  for (const [variables, error] of cases) {
    assert.throws(() => resolveRunners(variables, push), error, JSON.stringify(variables))
    assert.throws(() => resolveRunners(variables, { ...push, actor: 'dependabot[bot]' }), error)
  }
  // Labels match case-insensitively, as GitHub does.
  assert.deepEqual(resolveRunners({ RAY_RUNNER_IOS: '["Self-Hosted","MACOS"]' }, push).runners.ios, [
    'Self-Hosted',
    'MACOS'
  ])
})

test('reads the pull request head repository from the event payload', () => {
  const context = readContext({
    GITHUB_EVENT_NAME: 'pull_request',
    GITHUB_ACTOR: 'forkpath',
    GITHUB_REPOSITORY: 'forkpath/postfly.io',
    GITHUB_EVENT_PATH: resolve(root, 'does-not-exist.json')
  })
  assert.equal(context.headRepository, undefined)
  assert.equal(isTrustedForSelfHosted(context), false)
})

test('workflows pass every runner variable and keep Android and releases on hosted images', () => {
  const variables = [
    'RAY_RUNNER_IOS',
    'RAY_RUNNER_DESKTOP_MAC_ARM64',
    'RAY_RUNNER_DESKTOP_MAC_X64',
    'RAY_RUNNER_DESKTOP_WIN',
    'RAY_RUNNER_ANDROID'
  ]
  const ci = parse(readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8'))
  const selectEnv = ci.jobs.select.steps.find(step => step.id === 'suites').env
  const desktop = parse(readFileSync(resolve(root, '.github/workflows/desktop.yml'), 'utf8'))
  const resolveEnv = desktop.jobs.runners.steps.find(step => step.id === 'resolve').env
  for (const name of variables) {
    assert.equal(selectEnv[name], `\${{ vars.${name} }}`)
    assert.equal(resolveEnv[name], `\${{ vars.${name} }}`)
  }
  assert.equal(ci.jobs.mobile['runs-on'], '${{ matrix.runner }}')
  assert.equal(desktop.jobs.desktop['runs-on'], '${{ matrix.runner }}')
  assert.deepEqual(
    desktop.jobs.desktop.strategy.matrix.include.map(entry => entry.runner),
    ['desktopMacArm64', 'desktopMacX64', 'desktopWin'].map(
      role => `\${{ fromJSON(needs.runners.outputs.runners).${role} }}`
    )
  )
  // Signing secrets stay on clean hosted images.
  const release = parse(readFileSync(resolve(root, '.github/workflows/release-desktop.yml'), 'utf8'))
  assert.equal(JSON.stringify(release).includes('vars.RAY_RUNNER'), false)
})
