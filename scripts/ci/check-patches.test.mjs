import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import { parse } from 'yaml'

import { compareVersions, evaluatePatches, formatReport, parsePatchedDependencies } from './check-patches.mjs'

const root = resolve(import.meta.dirname, '../..')

test('parses every patched dependency declared in the workspace, matching a real YAML parser', () => {
  const source = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8')
  const expected = Object.entries(parse(source).patchedDependencies ?? {}).map(([spec, patch]) => {
    const at = spec.lastIndexOf('@')
    return { name: spec.slice(0, at), version: spec.slice(at + 1), patch }
  })
  assert.ok(expected.length > 0)
  assert.deepEqual(parsePatchedDependencies(source), expected)
})

test('parses scoped and quoted package names and stops at the next top-level key', () => {
  const source = [
    'packages: []',
    'patchedDependencies:',
    "  '@scope/pkg@1.2.3': patches/@scope__pkg@1.2.3.patch",
    '  plain@0.1.0: "patches/plain@0.1.0.patch" # note',
    'other:',
    '  ignored@9.9.9: nope'
  ].join('\n')
  assert.deepEqual(parsePatchedDependencies(source), [
    { name: '@scope/pkg', version: '1.2.3', patch: 'patches/@scope__pkg@1.2.3.patch' },
    { name: 'plain', version: '0.1.0', patch: 'patches/plain@0.1.0.patch' }
  ])
  assert.deepEqual(parsePatchedDependencies('packages: []'), [])
})

test('compares release versions numerically and rejects unsupported formats', () => {
  assert.ok(compareVersions('1.10.0', '1.9.9') > 0)
  assert.equal(compareVersions('3.0.3', '3.0.3'), 0)
  assert.throws(() => compareVersions('1.0.0-beta.1', '1.0.0'), /Unsupported/)
})

test('reports newer stable releases, ignores prereleases/deprecated ones, and surfaces expiry', () => {
  const patches = [
    { name: 'braces', version: '3.0.3', patch: 'p1' },
    { name: 'node-forge', version: '1.4.0', patch: 'p2' },
    { name: 'missing', version: '1.0.0', patch: 'p3' }
  ]
  const docs = new Map([
    [
      'braces',
      {
        versions: { '3.0.2': {}, '3.0.3': {}, '3.0.4-rc.1': {}, '3.0.4': { deprecated: 'broken' }, '3.0.5': {} },
        'dist-tags': { latest: '3.0.5' }
      }
    ],
    ['node-forge', { versions: { '1.3.1': {}, '1.4.0': {} }, 'dist-tags': { latest: '1.4.0' } }]
  ])
  const mitigations = [{ package: 'node-forge', version: '1.4.0', expiresAt: '2026-10-16T00:00:00.000Z' }]
  const results = evaluatePatches(patches, docs, mitigations, new Date('2026-10-09T00:00:00Z'))

  assert.deepEqual(
    results.map(({ name, status, newer, daysUntilExpiry }) => ({ name, status, newer, daysUntilExpiry })),
    [
      { name: 'braces', status: 'review-upstream-release', newer: ['3.0.5'], daysUntilExpiry: null },
      { name: 'node-forge', status: 'no-upstream-release', newer: [], daysUntilExpiry: 7 },
      { name: 'missing', status: 'registry-error', newer: [], daysUntilExpiry: null }
    ]
  )
  const report = formatReport(results)
  assert.match(report, /\| braces@3\.0\.3 \| review-upstream-release \| 3\.0\.5 \| - \|/)
  assert.match(report, /\| node-forge@1\.4\.0 \| no-upstream-release \| - \| 2026-10-16 \(7 天\) \|/)
})
