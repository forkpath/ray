import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import { parse } from 'yaml'

import {
  deploymentConfig,
  findStagingReceipt,
  githubClient,
  releaseTarget,
  services,
  verifyHead,
  verifyReceipt,
  verifyStagingRun
} from '../release/promotion.mjs'
import { infrastructureImages } from '../testing/backend-containers.mjs'

const commit = 'a'.repeat(40)
const repository = 'fixture/ray'
const production = {
  GITHUB_REPOSITORY: repository,
  GITHUB_SHA: commit,
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'push'
}
const target = releaseTarget(production)
function stagingRun() {
  return {
    id: 42,
    run_attempt: 2,
    path: '.github/workflows/ci.yml',
    repository: { full_name: repository },
    head_repository: { full_name: repository },
    event: 'push',
    head_branch: 'dev',
    head_sha: commit,
    status: 'completed',
    conclusion: 'success'
  }
}
function receipt() {
  return {
    version: 1,
    repository,
    commit,
    environment: 'staging',
    runId: 42,
    runAttempt: 2,
    images: Object.fromEntries(
      services.map(service => [service, `${target.prefix}/${service}@sha256:${'b'.repeat(64)}`])
    )
  }
}

test('staging follows dev push CI; production accepts main only, with the triggering commit', () => {
  assert.equal(target.environment, 'production')
  assert.equal(
    releaseTarget({
      ...production,
      RELEASE_ENVIRONMENT: 'staging',
      GITHUB_REF: 'refs/heads/dev',
      GITHUB_WORKFLOW: 'CI'
    }).environment,
    'staging'
  )
  for (const change of [
    { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_REF: 'refs/heads/dev' },
    { RELEASE_COMMIT: 'c'.repeat(40) },
    { RELEASE_ENVIRONMENT: 'preview' }
  ])
    assert.throws(() => releaseTarget({ ...production, ...change }))
  assert.throws(() => releaseTarget({ ...production, RELEASE_ENVIRONMENT: 'staging', GITHUB_REF: 'refs/heads/dev' }))
})

test('PR, fork, other commits, incomplete or failed staging runs cannot authorize production', () => {
  verifyStagingRun(stagingRun(), target)
  for (const change of [
    { path: '.github/workflows/other.yml' },
    { event: 'pull_request' },
    { head_branch: 'main' },
    { head_repository: { full_name: 'outsider/ray' } },
    { head_sha: 'c'.repeat(40) },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { conclusion: 'skipped' },
    { conclusion: 'cancelled' }
  ])
    assert.throws(() => verifyStagingRun({ ...stagingRun(), ...change }, target))
})

test('promotion binds all five immutable images to the exact staging run and attempt', () => {
  assert.deepEqual(verifyReceipt(receipt(), target, stagingRun()), receipt().images)
  for (const change of [
    { commit: 'c'.repeat(40) },
    { repository: 'other/ray' },
    { runId: 41 },
    { runAttempt: 1 },
    { environment: 'production' }
  ])
    assert.throws(() => verifyReceipt({ ...receipt(), ...change }, target, stagingRun()))
  for (const invalid of [
    `${target.prefix}/engine:latest`,
    `ghcr.io/other/ray/engine@sha256:${'b'.repeat(64)}`,
    `${target.prefix}/engine@sha256:${'b'.repeat(64)}@extra`
  ]) {
    const input = receipt()
    input.images.engine = invalid
    assert.throws(() => verifyReceipt(input, target, stagingRun()))
  }
  const missing = receipt()
  delete missing.images.worker
  assert.throws(() => verifyReceipt(missing, target, stagingRun()))
})

test('GitHub lookup and the real command bind outputs to the current branch and successful staging attempt', async t => {
  let runs = [stagingRun()]
  let expired = false
  let head = commit
  const requests = []
  const server = createServer((request, response) => {
    requests.push(request.url)
    assert.equal(request.headers.authorization, 'Bearer isolated-test-token')
    response.setHeader('content-type', 'application/json')
    const url = new URL(request.url, 'http://localhost')
    if (url.pathname.endsWith('/git/ref/heads/main')) response.end(JSON.stringify({ object: { sha: head } }))
    else if (url.pathname.endsWith('/actions/workflows/ci.yml/runs')) {
      assert.equal(url.searchParams.get('head_sha'), commit)
      assert.equal(url.searchParams.get('branch'), 'dev')
      assert.equal(url.searchParams.has('status'), false)
      response.end(JSON.stringify({ workflow_runs: runs }))
    } else if (url.pathname.endsWith('/actions/runs/42/artifacts')) {
      response.end(JSON.stringify({ artifacts: [{ id: 73, name: `staging-release-${commit}`, expired }] }))
    } else {
      response.statusCode = 403
      response.end('{}')
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const api = githubClient({
    ...production,
    GITHUB_TOKEN: 'isolated-test-token',
    GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`
  })
  await verifyHead(api, target)
  assert.equal((await findStagingReceipt(api, target)).artifact.id, 73)
  const directory = mkdtempSync(join(tmpdir(), 'ray-promotion-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const output = join(directory, 'outputs')
  const script = resolve('scripts/release/promotion.mjs')
  async function command(mode, extra = {}) {
    writeFileSync(output, '')
    const child = spawn(process.execPath, [script, mode], {
      cwd: directory,
      env: {
        ...production,
        GITHUB_TOKEN: 'isolated-test-token',
        GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
        GITHUB_OUTPUT: output,
        ...extra
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let error = ''
    child.stderr.on('data', chunk => {
      error += chunk
    })
    child.stdout.resume()
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', resolve)
    })
    return { code, error, outputs: readFileSync(output, 'utf8') }
  }
  const resolved = await command('resolve')
  assert.equal(resolved.code, 0, resolved.error)
  assert.match(resolved.outputs, /source_run=42\nsource_attempt=2\nartifact_id=73/)
  mkdirSync(join(directory, 'dist/release'), { recursive: true })
  writeFileSync(join(directory, 'dist/release/release.json'), JSON.stringify(receipt()))
  const validated = await command('validate', { SOURCE_RUN_ID: '42', SOURCE_RUN_ATTEMPT: '2' })
  assert.equal(validated.code, 0, validated.error)
  assert.equal(validated.outputs.split('\n').filter(Boolean).length, 5)
  const stale = await command('validate', { SOURCE_RUN_ID: '42', SOURCE_RUN_ATTEMPT: '3' })
  assert.notEqual(stale.code, 0)
  assert.equal(stale.outputs, '')
  head = 'd'.repeat(40)
  await assert.rejects(verifyHead(api, target), /obsolete deployment/)
  expired = true
  await assert.rejects(findStagingReceipt(api, target), /expired/)
  expired = false
  runs = [...runs, { ...stagingRun(), id: 43, conclusion: 'failure' }]
  await assert.rejects(findStagingReceipt(api, target), /failed/)
  assert.equal(
    requests.some(path => path.includes('/43/artifacts')),
    false
  )
  runs = []
  await assert.rejects(findStagingReceipt(api, target), /No dev CI/)
  await assert.rejects(api('forbidden'), /GitHub 403/)
})

test('deployment configuration requires environment credentials, HTTPS and a pinned SSH host', () => {
  const env = {
    DEPLOY_HOST: 'example.invalid',
    DEPLOY_USER: 'ray',
    DEPLOY_SSH_KEY: 'isolated-test-value',
    GHCR_TOKEN: 'isolated-test-value',
    PUBLIC_ORIGIN: 'https://example.invalid',
    DEPLOY_HOST_FINGERPRINT: `SHA256:${'a'.repeat(43)}`,
    DEPLOY_PATH: '/opt/ray-staging'
  }
  deploymentConfig(env)
  for (const change of [
    { DEPLOY_SSH_KEY: '' },
    { DEPLOY_HOST_FINGERPRINT: '' },
    { DEPLOY_PATH: '/opt/../ray' },
    { DEPLOY_PATH: '/opt/ray;whoami' },
    { DEPLOY_PORT: '70000' },
    { PUBLIC_ORIGIN: 'http://example.invalid' },
    { PUBLIC_ORIGIN: 'https://example.invalid/' }
  ])
    assert.throws(() => deploymentConfig({ ...env, ...change }))
})

test('development, Testcontainers and deployment use the same immutable infrastructure versions', () => {
  const development = parse(readFileSync('docker/docker-compose.dev.yml', 'utf8'))
  assert.deepEqual(Object.keys(infrastructureImages).sort(), ['kong', 'mongo', 'postgres', 'rabbitmq', 'redis'])
  for (const [service, image] of Object.entries(infrastructureImages)) {
    assert.match(image, /^docker\.io\/library\/[a-z]+:[\w.-]+@sha256:[a-f0-9]{64}$/)
    assert.equal(development.services[service].image, image)
  }
  for (const workflow of ['ci', 'deploy']) {
    const config = parse(readFileSync(`.github/workflows/${workflow}.yml`, 'utf8'))
    const databases = Object.values(config.jobs).flatMap(job => Object.values(job.services ?? {}))
    assert.ok(databases.length > 0)
    for (const database of databases) assert.equal(database.image, infrastructureImages.postgres)
  }
  const app = parse(readFileSync('docker/docker-compose.app.yml', 'utf8'), { merge: true })
  for (const service of ['engine', 'pulse', 'worker']) {
    assert.equal(app.services[service].environment.REDIS_PORT, 6379)
    assert.equal(app.services[service].environment.MONGO_PORT, 27017)
  }
})

test('the workflow gates staging behind all required tests and only issues receipts after deployment smoke', () => {
  const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'))
  const deploy = parse(readFileSync('.github/workflows/deploy.yml', 'utf8'))
  assert.deepEqual(ci.on.push.branches, ['dev'])
  const extensionRelease = parse(readFileSync('.github/workflows/release-extension.yml', 'utf8'))
  assert.equal(ci.on.push.tags, undefined)
  assert.deepEqual(extensionRelease.on.push.tags, ['v*'])
  assert.equal(extensionRelease.jobs['quality-gate'].uses, './.github/workflows/ci.yml')
  assert.equal(extensionRelease.jobs['quality-gate'].with.full, true)
  assert.equal(extensionRelease.jobs['quality-gate'].permissions.packages, 'write')
  assert.deepEqual(deploy.on.push.branches, ['main'])
  assert.equal(ci.jobs['deploy-staging'].needs, 'required-checks')
  assert.equal(ci.jobs['staging-deployment'].name, 'Staging deployment')
  assert.equal(ci.jobs['staging-deployment'].needs, 'deploy-staging')
  assert.match(ci.jobs['staging-deployment'].if, /always\(\)/)
  assert.ok(ci.jobs['required-checks'].needs.includes('security'))
  assert.match(ci.jobs['deploy-staging'].if, /github.event_name == 'push'/)
  assert.match(ci.jobs['deploy-staging'].if, /refs\/heads\/dev/)
  // A successful aggregate can have deliberately skipped ancestors. An explicit
  // status function prevents GitHub's implicit success() from skipping deploy.
  assert.match(ci.jobs['deploy-staging'].if, /always\(\)/)
  assert.match(ci.jobs['deploy-staging'].if, /!cancelled\(\)/)
  assert.match(ci.jobs['deploy-staging'].if, /needs.required-checks.result == 'success'/)
  assert.match(deploy.jobs['build-and-push'].if, /environment == 'staging'/)
  assert.equal(deploy.jobs.deploy.environment.name, '${{ needs.resolve.outputs.environment }}')
  const steps = deploy.jobs.deploy.steps
  const smoke = steps.findIndex(step => step.run?.includes('framework-smoke.mjs'))
  const receipt = steps.findIndex(step => step.run?.endsWith('promotion.mjs receipt'))
  const upload = steps.findIndex(step => step.with?.name?.startsWith('staging-release-'))
  assert.ok(smoke >= 0 && smoke < receipt && receipt < upload)
  assert.equal(steps[upload]['continue-on-error'], undefined)
  assert.equal(deploy.concurrency['cancel-in-progress'], false)
})

test('branch policy: PRs into dev and arch are tested, dev deploys staging, main deploys without CI', () => {
  const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'))
  const deploy = parse(readFileSync('.github/workflows/deploy.yml', 'utf8'))
  const policy = parse(readFileSync('.github/workflows/pr-policy.yml', 'utf8'))
  assert.deepEqual(ci.on.pull_request.branches, ['dev', 'arch'])
  assert.deepEqual(ci.on.push.branches, ['dev'])
  assert.equal(ci.permissions['pull-requests'], 'read')
  // main is fast-forwarded to a staging-verified dev commit and deployed by deploy.yml alone.
  assert.equal(ci.jobs['deploy-production'], undefined)
  assert.deepEqual(deploy.on.push.branches, ['main'])
  // PR policy must report on every pull request, including those targeting main.
  assert.equal(policy.on.pull_request.branches, undefined)
  assert.equal(policy.jobs.policy.name, 'PR policy')
})

test('every workflow that calls CI grants every permission CI or its jobs request', () => {
  const ci = parse(readFileSync('.github/workflows/ci.yml', 'utf8'))
  const rank = { none: 0, read: 1, write: 2 }
  // GitHub validates nested job permissions before any job runs, even jobs that `if` would skip.
  const requested = {}
  for (const permissions of [ci.permissions, ...Object.values(ci.jobs).map(job => job.permissions ?? {})]) {
    for (const [scope, level] of Object.entries(permissions)) {
      if (rank[level] > rank[requested[scope] ?? 'none']) requested[scope] = level
    }
  }
  const callers = readdirSync('.github/workflows')
    .filter(file => file.endsWith('.yml'))
    .flatMap(file =>
      Object.entries(parse(readFileSync(`.github/workflows/${file}`, 'utf8')).jobs ?? {})
        .filter(([, job]) => job.uses === './.github/workflows/ci.yml')
        .map(([name, job]) => ({ name: `${file}:${name}`, permissions: job.permissions ?? {} }))
    )
  assert.ok(callers.length > 0)
  for (const caller of callers) {
    for (const [scope, level] of Object.entries(requested)) {
      assert.ok(
        rank[caller.permissions[scope] ?? 'none'] >= rank[level],
        `${caller.name} must grant ${scope}: ${level}`
      )
    }
  }
})
