import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import { parse } from 'yaml'

import {
  desktopMatrix,
  HOSTED_RUNNERS,
  isTrustedForSelfHosted,
  readContext,
  resolveRunners,
  RUNNER_VARIABLES,
  skippedSummary
} from './runners.mjs'

const root = resolve(import.meta.dirname, '../..')
const push = { eventName: 'push', actor: 'forkpath', repository: 'forkpath/postfly.io' }
const mac = '["self-hosted","macOS","X64","ray-mac"]'
// The documented two-machine layout: one Intel Mac for every Apple and Android lane, one Windows PC.
const selfHosted = {
  RAY_RUNNER_IOS: mac,
  RAY_RUNNER_ANDROID: mac,
  RAY_RUNNER_DESKTOP_MAC_X64: mac,
  RAY_RUNNER_DESKTOP_WIN: '["self-hosted","Windows","X64","ray-win"]'
}
const macLabels = ['self-hosted', 'macOS', 'X64', 'ray-mac']

test('without variables every role stays on its hosted image', () => {
  assert.deepEqual(resolveRunners({}, push), { trusted: true, runners: HOSTED_RUNNERS, skipped: [] })
  assert.equal(HOSTED_RUNNERS.android, 'ubuntu-24.04')
  assert.deepEqual(resolveRunners({ RAY_RUNNER_IOS: '  ' }, push).runners.ios, 'macos-26')
  assert.deepEqual(
    desktopMatrix(HOSTED_RUNNERS).include.map(entry => [entry.os, entry.arch, entry.runner]),
    [
      ['macos-15-intel', 'x64', 'macos-15-intel'],
      ['windows-2025', 'x64', 'windows-2025'],
      ['macos-15', 'arm64', 'macos-15']
    ]
  )
})

test('trusted events use the configured self-hosted labels', () => {
  const { runners, skipped } = resolveRunners(selfHosted, push)
  assert.deepEqual(skipped, [])
  for (const role of ['ios', 'android', 'desktopMacX64']) assert.deepEqual(runners[role], macLabels)
  assert.deepEqual(runners.desktopWin, ['self-hosted', 'Windows', 'X64', 'ray-win'])
  // A role without a variable keeps its hosted image.
  assert.equal(runners.desktopMacArm64, 'macos-15')
  for (const eventName of ['workflow_dispatch', 'schedule']) {
    assert.equal(resolveRunners(selfHosted, { ...push, eventName }).trusted, true)
  }
  // Android also accepts a Linux machine with KVM.
  assert.deepEqual(resolveRunners({ RAY_RUNNER_ANDROID: '["self-hosted","Linux","X64"]' }, push).runners.android, [
    'self-hosted',
    'Linux',
    'X64'
  ])
  const arm64 = resolveRunners({ RAY_RUNNER_DESKTOP_MAC_ARM64: '["self-hosted","macOS","ARM64"]' }, push).runners
  assert.deepEqual(desktopMatrix(arm64).include.at(-1), {
    os: 'macos-15',
    arch: 'arm64',
    runner: ['self-hosted', 'macOS', 'ARM64']
  })
})

test('untrusted runs skip only self-hosted lanes whose hosted fallback is macOS', () => {
  const bot = { ...push, actor: 'dependabot[bot]' }
  const { trusted, runners, skipped } = resolveRunners(selfHosted, bot)
  assert.equal(trusted, false)
  // Linux (1x) and Windows (2x) fall back to hosted images; macOS (10x) lanes are not run.
  assert.equal(runners.android, 'ubuntu-24.04')
  assert.equal(runners.desktopWin, 'windows-2025')
  assert.equal(runners.ios, null)
  assert.equal(runners.desktopMacX64, null)
  assert.deepEqual(
    skipped.map(entry => entry.role),
    ['ios', 'desktopMacX64']
  )
  // The unconfigured arm64 lane keeps its hosted image.
  assert.deepEqual(
    desktopMatrix(runners).include.map(entry => entry.runner),
    ['windows-2025', 'macos-15']
  )
  assert.match(skippedSummary(skipped), /RAY_RUNNER_UNTRUSTED=hosted/)
  assert.equal(skippedSummary([]), '')
  // An unconfigured macOS role stays hosted: only self-hosted lanes are affected.
  assert.equal(resolveRunners({ ...selfHosted, RAY_RUNNER_IOS: '' }, bot).runners.ios, 'macos-26')

  const hosted = resolveRunners({ ...selfHosted, RAY_RUNNER_UNTRUSTED: 'hosted' }, bot)
  assert.deepEqual(hosted.runners, HOSTED_RUNNERS)
  assert.deepEqual(hosted.skipped, [])
  const arm64 = resolveRunners({ RAY_RUNNER_DESKTOP_MAC_ARM64: '["self-hosted","macOS","ARM64"]' }, bot)
  assert.equal(arm64.runners.desktopMacArm64, null)
  assert.deepEqual(
    arm64.skipped.map(entry => entry.role),
    ['desktopMacArm64']
  )
  assert.throws(() => resolveRunners({ RAY_RUNNER_UNTRUSTED: 'self-hosted' }, push), /RAY_RUNNER_UNTRUSTED/)
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
    assert.equal(Object.values(runners).some(Array.isArray), false)
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
    // The Android runner script supports macOS and Linux hosts, not Windows.
    [{ RAY_RUNNER_ANDROID: '["self-hosted","Windows","X64"]' }, /"Linux" or the "macOS"/]
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

test('workflows pass every runner variable and keep releases on hosted images', () => {
  const variables = RUNNER_VARIABLES
  assert.equal(variables.length, 6)
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
  assert.equal(desktop.jobs.desktop.strategy.matrix, '${{ fromJSON(needs.runners.outputs.desktop) }}')
  assert.equal(desktop.jobs.desktop.if, "needs.runners.outputs.desktopEnabled == 'true'")
  assert.equal(ci.jobs.mobile.if, "needs.select.outputs.mobileEnabled == 'true'")
  // Signing secrets stay on clean hosted images.
  const release = parse(readFileSync(resolve(root, '.github/workflows/release-desktop.yml'), 'utf8'))
  assert.equal(JSON.stringify(release).includes('vars.RAY_RUNNER'), false)
})
