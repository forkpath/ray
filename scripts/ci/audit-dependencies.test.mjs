import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'

import { parse } from 'yaml'

import { evaluateAudit } from './audit-dependencies.mjs'

const files = ['patches/node-forge@1.4.0.patch', 'scripts/ci/node-forge-patch.test.mjs']
const contents = 'isolated reviewed fixture'
const hash = createHash('sha256').update(contents).digest('hex')
const now = new Date('2026-10-03T00:00:00Z')
const reviewed = [
  ['node-forge', '1.4.0'],
  ['http-cache-semantics', '4.2.0'],
  ['braces', '3.0.3']
]
// Minimal pnpm workspace and lockfile in the real layout. Every patch file holds `contents`.
const workspaceYaml = [
  'packages: []',
  'patchedDependencies:',
  ...reviewed.map(([n, v]) => `  ${n}@${v}: patches/${n}@${v}.patch`)
].join('\n')
function lockYaml({ patchHash = hash, snapshots } = {}) {
  return [
    "lockfileVersion: '9.0'",
    '',
    'patchedDependencies:',
    ...reviewed.flatMap(([n, v]) => [`  ${n}@${v}:`, `    hash: ${patchHash}`, `    path: patches/${n}@${v}.patch`]),
    '',
    'packages:',
    '',
    ...reviewed.flatMap(([n, v]) => [`  ${n}@${v}:`, `    resolution: {integrity: sha512-x}`, '']),
    'snapshots:',
    '',
    ...(snapshots ?? reviewed.map(([n, v]) => `  ${n}@${v}(patch_hash=${hash}): {}`))
  ].join('\n')
}
function reader(overrides = {}) {
  return path => {
    if (path in overrides) {
      const value = overrides[path]
      if (value instanceof Error) throw value
      return value
    }
    if (path === 'pnpm-workspace.yaml') return workspaceYaml
    if (path === 'pnpm-lock.yaml') return lockYaml()
    return contents
  }
}
const options = { now, read: reader() }
function fixture() {
  const advisory = {
    github_advisory_id: 'GHSA-86w9-cpqp-85rv',
    module_name: 'node-forge',
    severity: 'high',
    updated: '2026-10-01T21:09:10.000Z',
    vulnerable_versions: '<=1.4.0',
    patched_versions: '<0.0.0',
    findings: [{ version: '1.4.0', paths: ['.>expo>@expo/cli>node-forge'] }]
  }
  const report = {
    advisories: { 1240912: advisory },
    muted: [],
    metadata: { vulnerabilities: { info: 0, low: 12, moderate: 59, high: 1, critical: 0 } }
  }
  const policy = {
    version: 1,
    mitigations: [
      {
        advisory: advisory.github_advisory_id,
        package: advisory.module_name,
        version: '1.4.0',
        severity: 'high',
        paths: [...advisory.findings[0].paths],
        advisoryUpdated: advisory.updated,
        vulnerableVersions: advisory.vulnerable_versions,
        patchedVersions: advisory.patched_versions,
        reviewedAt: '2026-10-02T00:00:00Z',
        expiresAt: '2026-10-16T00:00:00Z',
        files: Object.fromEntries(files.map(file => [file, hash]))
      }
    ]
  }
  return { advisory, report, policy }
}

test('a patch is reported separately without rewriting the raw high vulnerability', () => {
  const { report, policy } = fixture()
  const original = JSON.stringify(report)
  const result = evaluateAudit(report, policy, options)
  assert.equal(result.passed, true)
  assert.equal(result.rawVulnerabilities.high, 1)
  assert.equal(result.mitigated.length, 1)
  assert.equal(result.unresolved.length, 0)
  assert.equal(JSON.stringify(report), original)
})

test('a clean raw scan needs no mitigation', () => {
  const { report } = fixture()
  report.advisories = {}
  report.metadata.vulnerabilities.high = 0
  assert.equal(evaluateAudit(report, { version: 1, mitigations: [] }, options).passed, true)
})

test('changed advisory identity, scope, severity, package, version and paths fail closed', () => {
  for (const change of [
    { github_advisory_id: 'GHSA-new-advisory' },
    { module_name: 'other-package' },
    { updated: '2026-10-02T01:00:00.000Z' },
    { vulnerable_versions: '<=1.4.1' },
    { patched_versions: '>=1.4.1' },
    { findings: [{ version: '1.3.0', paths: ['.>expo>@expo/cli>node-forge'] }] },
    { findings: [{ version: '1.4.0', paths: ['.>expo>@expo/cli>node-forge', '.>runtime>node-forge'] }] },
    { severity: 'critical' }
  ]) {
    const { report, advisory, policy } = fixture()
    Object.assign(advisory, change)
    if (change.severity) {
      report.metadata.vulnerabilities.high = 0
      report.metadata.vulnerabilities.critical = 1
    }
    assert.equal(evaluateAudit(report, policy, options).passed, false, JSON.stringify(change))
  }
})

test('every reviewed input must exist with its exact hash', () => {
  for (const file of files) {
    const { report, policy } = fixture()
    assert.equal(evaluateAudit(report, policy, { ...options, read: reader({ [file]: 'changed' }) }).passed, false)
    assert.equal(
      evaluateAudit(report, policy, { ...options, read: reader({ [file]: new Error('missing') }) }).passed,
      false
    )
    delete policy.mitigations[0].files[file]
    assert.equal(evaluateAudit(report, policy, options).passed, false)
  }
})

test('expired, future, duplicate and unbounded mitigations cannot authorize a scan', () => {
  for (const time of ['2026-10-01T23:59:59Z', '2026-10-16T00:00:00Z', '2027-01-01T00:00:00Z']) {
    const { report, policy } = fixture()
    assert.equal(evaluateAudit(report, policy, { ...options, now: new Date(time) }).passed, false)
  }
  const { report, policy } = fixture()
  policy.mitigations[0].expiresAt = '2027-01-01T00:00:00Z'
  assert.equal(evaluateAudit(report, policy, options).passed, false)
  policy.mitigations.push(policy.mitigations[0])
  assert.equal(evaluateAudit(report, policy, options).passed, false)
})

test('additional high or critical findings cannot inherit the local mitigation', () => {
  for (const severity of ['high', 'critical']) {
    const { report, policy } = fixture()
    report.advisories.new = {
      ...structuredClone(report.advisories['1240912']),
      github_advisory_id: 'GHSA-unreviewed',
      module_name: 'other',
      severity
    }
    report.metadata.vulnerabilities[severity]++
    const result = evaluateAudit(report, policy, options)
    assert.equal(result.passed, false)
    assert.equal(result.mitigated.length, 1)
    assert.equal(result.unresolved.length, 1)
  }
})

for (const [id, name, version, testFile] of [
  ['GHSA-ch52-4w7c-c8xp', 'http-cache-semantics', '4.2.0', 'http-cache-semantics-patch'],
  ['GHSA-vfj7-8cjw-p6xm', 'braces', '3.0.3', 'braces-patch']
]) {
  test(`${name} requires its own reviewed patch and regression tests`, () => {
    const { report, advisory, policy } = fixture()
    Object.assign(advisory, { github_advisory_id: id, module_name: name })
    advisory.findings[0].version = version
    const entry = policy.mitigations[0]
    Object.assign(entry, { advisory: id, package: name, version })
    assert.equal(
      evaluateAudit(report, policy, options).passed,
      false,
      'node-forge files cannot authorize another patch'
    )
    const required = [`patches/${name}@${version}.patch`, `scripts/ci/${testFile}.test.mjs`]
    entry.files = Object.fromEntries(required.map(file => [file, hash]))
    assert.equal(evaluateAudit(report, policy, options).passed, true)
    for (const file of required) {
      assert.equal(evaluateAudit(report, policy, { ...options, read: reader({ [file]: 'changed' }) }).passed, false)
      delete entry.files[file]
      assert.equal(evaluateAudit(report, policy, options).passed, false)
      entry.files[file] = hash
    }
  })
}

test('even matching policy records cannot reuse a known patch for unreviewed findings', () => {
  for (const change of [
    { advisory: 'GHSA-unreviewed' },
    { package: 'unreviewed' },
    { version: '1.4.1' },
    { severity: 'critical' }
  ]) {
    const { report, advisory, policy } = fixture()
    Object.assign(policy.mitigations[0], change)
    const entry = policy.mitigations[0]
    Object.assign(advisory, {
      github_advisory_id: entry.advisory,
      module_name: entry.package,
      severity: entry.severity
    })
    advisory.findings[0].version = entry.version
    if (change.severity) {
      report.metadata.vulnerabilities.high = 0
      report.metadata.vulnerabilities.critical = 1
    }
    const result = evaluateAudit(report, policy, options)
    assert.equal(result.passed, false)
    assert.match(result.unresolved[0].reason, /No reviewed patch implementation/)
  }
})

test('missing findings, muted reports, scanner errors and inconsistent counts are failures', () => {
  for (const mutate of [
    report => {
      report.error = { message: 'registry unavailable' }
    },
    report => {
      report.muted = ['hidden finding']
    },
    report => {
      delete report.metadata
    },
    report => {
      report.advisories = {}
    },
    report => {
      report.advisories['1240912'].findings = []
    },
    report => {
      report.metadata.vulnerabilities.high = 2
    },
    report => {
      report.metadata.vulnerabilities.critical = 1
    }
  ]) {
    const { report, policy } = fixture()
    mutate(report)
    assert.throws(() => evaluateAudit(report, policy, options))
  }
})

test('the command preserves scanner output and rejects malformed or failed scans', t => {
  const directory = mkdtempSync(join(tmpdir(), 'ray-audit-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  mkdirSync(join(directory, 'bin'))
  mkdirSync(join(directory, '.github'))
  writeFileSync(join(directory, '.github/security-mitigations.json'), JSON.stringify({ version: 1, mitigations: [] }))
  writeFileSync(
    join(directory, 'bin/pnpm'),
    '#!/usr/bin/env node\nprocess.stdout.write(process.env.RAY_AUDIT_FIXTURE); process.exit(Number(process.env.RAY_AUDIT_STATUS))\n',
    { mode: 0o755 }
  )
  const { report } = fixture()
  report.advisories = {}
  report.metadata.vulnerabilities.high = 0
  for (const [raw, status, expected] of [
    [JSON.stringify(report), '0', 0],
    [JSON.stringify(report), '1', 1],
    [JSON.stringify(report), '2', 1],
    ['not JSON', '0', 1],
    ['{}', '0', 1],
    ['{"error":{"message":"registry offline"}}', '1', 1]
  ]) {
    const result = spawnSync(process.execPath, [resolve('scripts/ci/audit-dependencies.mjs')], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${join(directory, 'bin')}:${dirname(process.execPath)}:${process.env.PATH}`,
        RAY_AUDIT_FIXTURE: raw,
        RAY_AUDIT_STATUS: status
      }
    })
    assert.equal(result.status, expected, result.stderr + result.stdout)
    assert.equal(readFileSync(join(directory, 'dependency-audit.json'), 'utf8'), raw)
    assert.equal(
      JSON.parse(readFileSync(join(directory, 'dependency-audit-evaluation.json'), 'utf8')).passed,
      expected === 0
    )
  }
})

test('security runs before expensive CI; production repeats the same raw-audit evaluation', () => {
  const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'))
  assert.equal(ci.jobs.select.needs, 'security')
  assert.ok(ci.jobs['required-checks'].needs.includes('security'))
  for (const [file, job, name] of [
    ['security.yml', 'audit', 'dependency-audit'],
    ['deploy.yml', 'resolve', 'production-dependency-audit']
  ]) {
    const workflow = parse(readFileSync(`.github/workflows/${file}`, 'utf8'))
    assert.ok(workflow.jobs[job].steps.some(step => step.run === `node scripts/ci/audit-dependencies.mjs ${name}.json`))
    assert.ok(workflow.jobs[job].steps.some(step => step.with?.path?.includes(`${name}-evaluation.json`)))
  }
})

test('unrelated lockfile and workspace changes keep a reviewed patch valid', () => {
  const { report, policy } = fixture()
  const read = reader({
    'pnpm-lock.yaml': lockYaml() + '\n  expo@57.0.1: {}\n',
    'pnpm-workspace.yaml': workspaceYaml.replace('packages: []', 'packages: []\ncatalog:\n  expo: 57.0.1')
  })
  assert.equal(evaluateAudit(report, policy, { ...options, read }).passed, true)
})

test('dropping, changing or bypassing the patch in the lockfile fails closed', () => {
  const cases = {
    'workspace no longer applies the patch': { 'pnpm-workspace.yaml': 'packages: []\n' },
    'lockfile records another patch hash': { 'pnpm-lock.yaml': lockYaml({ patchHash: 'f'.repeat(64) }) },
    'lockfile no longer records the patch': {
      'pnpm-lock.yaml': lockYaml().replace(/^patchedDependencies:$/m, 'unrelated:')
    },
    'an unpatched copy is installed': {
      'pnpm-lock.yaml': lockYaml({
        snapshots: [`  node-forge@1.4.0(patch_hash=${hash}): {}`, '  node-forge@1.4.0: {}']
      })
    },
    'the reviewed version is not resolved': {
      'pnpm-lock.yaml': lockYaml().replace(/^  node-forge@1\.4\.0:$/m, '  node-forge@1.3.9:')
    }
  }
  for (const [label, overrides] of Object.entries(cases)) {
    const { report, policy } = fixture()
    const result = evaluateAudit(report, policy, { ...options, read: reader(overrides) })
    assert.equal(result.passed, false, label)
    assert.match(result.unresolved[0].reason, /pnpm-(lock|workspace)\.yaml/, label)
  }
})
