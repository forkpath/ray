import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

import { parse } from 'yaml'

// .github/rulesets/*.json are imported into GitHub by hand (branch-workflow.md, section 5.4).
// These tests keep them consistent with the workflows and the documented branch policy.
const root = resolve(import.meta.dirname, '../..')
const directory = resolve(root, '.github/rulesets')
const rulesets = Object.fromEntries(
  readdirSync(directory)
    .filter(file => file.endsWith('.json'))
    .map(file => [file.replace(/\.json$/, ''), JSON.parse(readFileSync(resolve(directory, file), 'utf8'))])
)
const GITHUB_ACTIONS_APP = 15368
const STAGING_STATUS = 'Staging verified'
const rule = (ruleset, type) => ruleset.rules.find(item => item.type === type)
const checks = ruleset => rule(ruleset, 'required_status_checks')?.parameters.required_status_checks.map(c => c.context)

test('one active branch ruleset per file, named after the file', () => {
  assert.deepEqual(Object.keys(rulesets).sort(), ['arch', 'dev', 'main-gate', 'main-release'])
  for (const [file, ruleset] of Object.entries(rulesets)) {
    assert.equal(ruleset.name, file)
    assert.equal(ruleset.target, 'branch')
    assert.equal(ruleset.enforcement, 'active')
  }
  assert.deepEqual(rulesets.dev.conditions.ref_name.include, ['refs/heads/dev'])
  assert.deepEqual(rulesets.arch.conditions.ref_name.include, ['refs/heads/arch'])
  assert.deepEqual(rulesets['main-gate'].conditions.ref_name.include, ['refs/heads/main'])
  assert.deepEqual(rulesets['main-release'].conditions.ref_name.include, ['refs/heads/main'])
})

test('required checks name real GitHub Actions jobs or the status CI writes', () => {
  const ciSource = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8')
  const ci = parse(ciSource)
  const policy = parse(readFileSync(resolve(root, '.github/workflows/pr-policy.yml'), 'utf8'))
  const jobNames = new Set([...Object.values(ci.jobs), ...Object.values(policy.jobs)].map(job => job.name))
  for (const ruleset of Object.values(rulesets)) {
    for (const check of rule(ruleset, 'required_status_checks')?.parameters.required_status_checks ?? []) {
      if (check.context === STAGING_STATUS) continue
      assert.ok(jobNames.has(check.context), `${ruleset.name}: no job named "${check.context}"`)
      assert.equal(check.integration_id, GITHUB_ACTIONS_APP)
    }
  }
  // Only the dev-push staging job writes the commit status main-gate requires.
  const staging = ci.jobs['staging-deployment']
  assert.match(staging.if, /github.event_name == 'push' && github.ref == 'refs\/heads\/dev'/)
  assert.equal(staging.permissions.statuses, 'write')
  assert.ok(staging.steps.some(step => step.run?.includes(`context='${STAGING_STATUS}'`)))
  assert.equal(ciSource.split(`context='${STAGING_STATUS}'`).length, 2)
  assert.deepEqual(checks(rulesets.dev), ['Required checks', 'PR policy'])
  assert.deepEqual(checks(rulesets.arch), ['Required checks', 'PR policy'])
  // main takes no pull requests, so PR policy would block its fast-forward pushes.
  assert.deepEqual(checks(rulesets['main-gate']), ['Required checks', STAGING_STATUS])
})

test('merge methods: rebase for work branches, merge commits only where arch enters dev, never squash', () => {
  const methods = name => rule(rulesets[name], 'pull_request').parameters.allowed_merge_methods
  assert.deepEqual(methods('dev'), ['merge', 'rebase'])
  assert.deepEqual(methods('arch'), ['rebase'])
  for (const name of ['dev', 'arch']) {
    const pullRequest = rule(rulesets[name], 'pull_request').parameters
    assert.equal(pullRequest.required_approving_review_count, 0)
    assert.equal(pullRequest.required_review_thread_resolution, true)
  }
  assert.ok(rule(rulesets.arch, 'required_linear_history'))
  assert.equal(rule(rulesets.arch, 'required_status_checks').parameters.strict_required_status_checks_policy, true)
  // dev receives arch merge commits, and arch cannot be updated from a dev pull request.
  assert.equal(rule(rulesets.dev, 'required_linear_history'), undefined)
  assert.equal(rule(rulesets.dev, 'required_status_checks').parameters.strict_required_status_checks_policy, false)
})

test('main is fast-forwarded only by the deploy key to a staging-deployed, tested commit', () => {
  const gate = rulesets['main-gate']
  const release = rulesets['main-release']
  // GitHub rejected required_deployments for this repository; the Staging verified status replaces it.
  assert.equal(rule(gate, 'required_deployments'), undefined)
  assert.ok(rule(gate, 'non_fast_forward'))
  assert.ok(rule(gate, 'deletion'))
  // No pull request rule (merge buttons create new SHAs) and no linear history (dev has merge commits).
  assert.equal(rule(gate, 'pull_request'), undefined)
  assert.equal(rule(gate, 'required_linear_history'), undefined)
  // A bypass only applies within its own ruleset: the deploy key passes "update" but not main-gate.
  assert.deepEqual(gate.bypass_actors, [])
  assert.deepEqual(
    release.rules.map(item => item.type),
    ['update']
  )
  assert.deepEqual(release.bypass_actors, [{ actor_id: null, actor_type: 'DeployKey', bypass_mode: 'always' }])
  for (const name of ['dev', 'arch']) assert.deepEqual(rulesets[name].bypass_actors, [])
})
