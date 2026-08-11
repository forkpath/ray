import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import {
  buildReleasePlan,
  createDeploymentEnvironment,
  releaseServices,
  runObservationWindow,
  runSmokeChecks,
  selectCandidateColor,
  selectRollbackRelease,
  toImageReference,
  validateBackupReceipt,
  validateMigrationMode,
  validateObservationSpec,
  validateReleaseManifest,
  validateRuntimeImageReferences,
  validateSmokeSpec
} from '../deploy/release-controller.mjs'

const gitSha = 'a'.repeat(40)
const digest = character => `sha256:${character.repeat(64)}`
const manifest = {
  schemaVersion: 1,
  gitSha,
  ref: 'refs/heads/main',
  images: Object.fromEntries(
    releaseServices.map((service, index) => [
      service,
      {
        image: `ghcr.io/forkpath/ray-${service}`,
        digest: digest(String(index + 1))
      }
    ])
  )
}

const smokeSpec = {
  schemaVersion: 1,
  baseUrl: 'https://ray.example.com',
  checks: [
    {
      name: 'engine-health',
      category: 'health',
      path: '/api/v1/health',
      expectedStatus: 200
    },
    {
      name: 'auth-session-boundary',
      category: 'auth',
      path: '/api/auth/get-session',
      expectedStatus: 200
    },
    {
      name: 'user-billing-boundary',
      category: 'billing',
      path: '/api/v1/billing/me',
      expectedStatus: 401
    },
    {
      name: 'organization-billing-boundary',
      category: 'organization',
      path: '/api/v1/organizations/smoke/billing',
      expectedStatus: 401
    }
  ]
}

const observationSpec = {
  schemaVersion: 1,
  url: 'https://metrics.example.com/ray/deployment-window',
  durationSeconds: 1,
  intervalSeconds: 1,
  thresholds: {
    errorRate: 0.02,
    p95LatencyMs: 750,
    authFailureRate: 0.05,
    databaseConnections: 180,
    queueDepth: 1_000
  }
}

async function runController(arguments_, environment) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, ['scripts/deploy/release-controller.mjs', ...arguments_], {
      cwd: process.cwd(),
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      stdout += chunk
    })
    child.stderr.on('data', chunk => {
      stderr += chunk
    })
    child.once('error', rejectPromise)
    child.once('exit', code => {
      if (code === 0) return resolvePromise({ stdout, stderr })
      rejectPromise(new Error(`controller exited ${code}: ${stderr}`))
    })
  })
}

async function listen(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise)
    server.listen(0, '127.0.0.1', resolvePromise)
  })
  return server.address().port
}

async function close(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.close(error => (error ? rejectPromise(error) : resolvePromise()))
  })
}

describe('release controller manifest', () => {
  it('accepts exactly five GHCR digests and creates immutable references', () => {
    const normalized = validateReleaseManifest(manifest)
    assert.deepEqual(Object.keys(normalized.images), releaseServices)
    assert.equal(toImageReference(normalized.images.engine), `ghcr.io/forkpath/ray-engine@${digest('1')}`)
  })

  it('rejects missing, mutable, mismatched, and non-production images', () => {
    const missing = structuredClone(manifest)
    delete missing.images.worker
    assert.throws(() => validateReleaseManifest(missing), /requires exactly/)

    const mutable = structuredClone(manifest)
    mutable.images.engine.digest = 'latest'
    assert.throws(() => validateReleaseManifest(mutable), /digest engine is invalid/)

    const mismatch = structuredClone(manifest)
    mismatch.images.engine.image = 'ghcr.io/forkpath/ray-worker'
    assert.throws(() => validateReleaseManifest(mismatch), /does not match engine/)

    const untrustedOwner = structuredClone(manifest)
    untrustedOwner.images.engine.image = 'ghcr.io/other-owner/ray-engine'
    assert.throws(() => validateReleaseManifest(untrustedOwner), /must use GHCR/)

    const branch = structuredClone(manifest)
    branch.ref = 'refs/heads/dev'
    assert.throws(() => validateReleaseManifest(branch), /main or a v\*/)
  })

  it('renders only digest identities and non-secret deployment metadata', () => {
    const environmentFile = createDeploymentEnvironment({
      manifest,
      runtimeEnvFile: '/secure/runtime.env',
      networkName: 'ray-production-platform',
      releaseId: `${gitSha}-operation`,
      color: 'blue'
    })
    assert.match(environmentFile, /ENGINE_IMAGE=ghcr\.io\/forkpath\/ray-engine@sha256:/)
    assert.match(environmentFile, /MIGRATOR_IMAGE=ghcr\.io\/forkpath\/ray-migrator@sha256:/)
    assert.match(environmentFile, /RAY_RUNTIME_ENV_FILE=\/secure\/runtime\.env/)
    assert.match(environmentFile, /RAY_COLOR=blue/)
    assert.doesNotMatch(environmentFile, /PASSWORD|SECRET|TOKEN|DATABASE_URL/)
  })
})

describe('backup and smoke gates', () => {
  it('requires immutable infrastructure and gateway image references', () => {
    const imageEnvironment = [
      `REDIS_IMAGE=redis@${digest('a')}`,
      `POSTGRES_IMAGE=postgres@${digest('b')}`,
      `MONGO_IMAGE=mongo@${digest('c')}`,
      `RABBITMQ_IMAGE=rabbitmq@${digest('d')}`,
      `KONG_IMAGE=kong@${digest('e')}`
    ].join('\n')
    assert.equal(validateRuntimeImageReferences(imageEnvironment).KONG_IMAGE, `kong@${digest('e')}`)
    assert.throws(
      () => validateRuntimeImageReferences(imageEnvironment.replace(`redis@${digest('a')}`, 'redis:latest')),
      /REDIS_IMAGE must be an immutable/
    )
  })

  it('requires a fresh, completed backup for the exact environment', () => {
    const now = Date.parse('2026-08-11T00:00:00.000Z')
    const receipt = {
      schemaVersion: 1,
      environment: 'production',
      status: 'completed',
      backupId: 'backup-20260811-001',
      database: 'ray-production-primary',
      completedAt: '2026-08-10T23:30:00.000Z'
    }
    assert.equal(
      validateBackupReceipt(receipt, {
        environment: 'production',
        now,
        maxAgeSeconds: 3600
      }).backupId,
      receipt.backupId
    )
    assert.throws(
      () =>
        validateBackupReceipt(
          { ...receipt, completedAt: '2026-08-10T20:00:00.000Z' },
          { environment: 'production', now, maxAgeSeconds: 3600 }
        ),
      /older than/
    )
    assert.throws(
      () => validateBackupReceipt({ ...receipt, environment: 'staging' }, { environment: 'production', now }),
      /environment mismatch/
    )
  })

  it('requires health, auth, billing, and organization smoke categories', () => {
    assert.equal(validateSmokeSpec(smokeSpec).checks.length, 4)
    assert.throws(
      () =>
        validateSmokeSpec({
          ...smokeSpec,
          checks: smokeSpec.checks.slice(0, 3)
        }),
      /missing organization/
    )
    assert.throws(
      () =>
        validateSmokeSpec({
          ...smokeSpec,
          baseUrl: 'http://ray.example.com'
        }),
      /must use HTTPS/
    )
    assert.throws(
      () =>
        validateSmokeSpec({
          ...smokeSpec,
          checks: smokeSpec.checks.map(check =>
            check.category === 'health' ? { ...check, expectedStatus: 500 } : check
          )
        }),
      /cannot treat 500 as healthy/
    )
    assert.throws(() => validateSmokeSpec({ ...smokeSpec, timeoutSeconds: 16 }), /must not exceed 15/)
  })

  it('runs deterministic smoke requests without printing credentials', async () => {
    const calls = []
    const results = await runSmokeChecks(smokeSpec, {
      fetchImplementation: async (url, options) => {
        calls.push({ url: url.toString(), method: options.method })
        const check = smokeSpec.checks[calls.length - 1]
        return { status: check.expectedStatus }
      }
    })
    assert.equal(results.length, 4)
    assert.equal(calls[0].url, 'https://ray.example.com/api/v1/health')
  })

  it('fails the observation window closed when a deployment threshold is exceeded', async () => {
    assert.equal(validateObservationSpec(observationSpec).durationSeconds, 1)
    const healthy = {
      status: 200,
      json: async () => ({
        errorRate: 0.01,
        p95LatencyMs: 300,
        authFailureRate: 0.01,
        databaseConnections: 40,
        queueDepth: 10
      })
    }
    await assert.doesNotReject(() =>
      runObservationWindow(observationSpec, { fetchImplementation: async () => healthy })
    )
    await assert.rejects(
      () =>
        runObservationWindow(observationSpec, {
          fetchImplementation: async () => ({
            ...healthy,
            json: async () => ({ ...(await healthy.json()), queueDepth: 1_001 })
          })
        }),
      /threshold exceeded: queueDepth/
    )
  })
})

describe('forward-only release and rollback plan', () => {
  it('migrates before switching and records active state before drain', () => {
    const plan = buildReleasePlan({
      manifest,
      environment: 'production',
      currentRelease: { releaseId: 'previous', color: 'green' },
      runtimeImages: { KONG_IMAGE: `kong@${digest('e')}` },
      migrationMode: 'expand'
    })
    const operations = plan.operations.map(item => item.operation)
    const migrationIndex = operations.indexOf('migrate-forward')
    const switchIndex = operations.indexOf('atomic-gateway-switch')
    assert.ok(migrationIndex < switchIndex)
    assert.ok(operations.indexOf('record-active-release') < operations.indexOf('drain-previous-color'))
    assert.equal(operations.at(-1), 'record-drain-outcome')
    assert.equal(plan.previousReleaseId, 'previous')
    assert.equal(plan.operations.find(item => item.service === 'kong').image, `kong@${digest('e')}`)
    assert.equal(plan.candidateColor, 'blue')
    assert.equal(selectCandidateColor({ color: 'blue' }), 'green')
    assert.equal(validateMigrationMode('expand'), 'expand')
    assert.throws(() => validateMigrationMode('contract'), /expand or none/)

    const noMigrationPlan = buildReleasePlan({
      manifest,
      environment: 'production',
      currentRelease: null,
      runtimeImages: { KONG_IMAGE: `kong@${digest('e')}` },
      migrationMode: 'none'
    })
    assert.equal(
      noMigrationPlan.operations.some(item => item.operation === 'migrate-forward'),
      false
    )
  })

  it('selects the newest prior installed release without database rollback', () => {
    const releases = [
      {
        releaseId: 'old',
        status: 'installed',
        deployedAt: '2026-08-01T00:00:00.000Z',
        manifest: { ...manifest, gitSha: 'b'.repeat(40) }
      },
      {
        releaseId: 'newer',
        status: 'installed',
        deployedAt: '2026-08-02T00:00:00.000Z',
        manifest: { ...manifest, gitSha: 'c'.repeat(40) }
      }
    ]
    assert.equal(selectRollbackRelease(releases, { releaseId: 'current' }, undefined).releaseId, 'newer')
    assert.equal(selectRollbackRelease(releases, { releaseId: 'current' }, 'b'.repeat(40)).releaseId, 'old')
  })

  it('installs twice and restores only prior application digests', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ray-release-controller-'))
    const binDirectory = join(directory, 'bin')
    const runtimeEnv = join(directory, 'runtime.env')
    const manifestPath = join(directory, 'manifest.json')
    const backupPath = join(directory, 'backup.json')
    const smokePath = join(directory, 'smoke.json')
    const observationPath = join(directory, 'observation.json')
    const stateDirectory = join(directory, 'state')
    const dockerLog = join(directory, 'docker.log')
    const fakeDocker = join(binDirectory, 'docker')
    let failNextSmoke = false
    let failNextObservation = false
    const server = createServer((request, response) => {
      if (request.url === '/deployment-metrics') {
        const queueDepth = failNextObservation ? 1_001 : 10
        failNextObservation = false
        response.setHeader('Content-Type', 'application/json')
        response.end(
          JSON.stringify({
            errorRate: 0.01,
            p95LatencyMs: 300,
            authFailureRate: 0.01,
            databaseConnections: 40,
            queueDepth
          })
        )
        return
      }
      if (failNextSmoke) {
        failNextSmoke = false
        response.statusCode = 500
        response.end()
        return
      }
      response.statusCode = request.url?.includes('billing') ? 401 : 200
      response.end()
    })

    try {
      await mkdir(binDirectory, { recursive: true })
      await writeFile(fakeDocker, '#!/bin/sh\nprintf \'%s\\n\' "$*" >> "$FAKE_DOCKER_LOG"\n', {
        mode: 0o755
      })
      await chmod(fakeDocker, 0o755)
      await writeFile(
        runtimeEnv,
        [
          `REDIS_IMAGE=redis@${digest('a')}`,
          `POSTGRES_IMAGE=postgres@${digest('b')}`,
          `MONGO_IMAGE=mongo@${digest('c')}`,
          `RABBITMQ_IMAGE=rabbitmq@${digest('d')}`,
          `KONG_IMAGE=kong@${digest('e')}`
        ].join('\n'),
        { mode: 0o600 }
      )
      await chmod(runtimeEnv, 0o600)
      await writeFile(manifestPath, JSON.stringify(manifest))
      await writeFile(
        backupPath,
        JSON.stringify({
          schemaVersion: 1,
          environment: 'integration',
          status: 'completed',
          backupId: 'integration-backup',
          database: 'integration-database',
          completedAt: new Date().toISOString()
        })
      )
      const port = await listen(server)
      await writeFile(smokePath, JSON.stringify({ ...smokeSpec, baseUrl: `http://127.0.0.1:${port}` }))
      await writeFile(
        observationPath,
        JSON.stringify({ ...observationSpec, url: `http://127.0.0.1:${port}/deployment-metrics` })
      )

      const sharedArguments = [
        '--environment',
        'integration',
        '--manifest',
        manifestPath,
        '--backup-receipt',
        backupPath,
        '--smoke-spec',
        smokePath,
        '--observation-spec',
        observationPath,
        '--migration-mode',
        'expand',
        '--runtime-env',
        runtimeEnv,
        '--state-dir',
        stateDirectory,
        '--apply'
      ]
      const environment = {
        ...process.env,
        PATH: `${binDirectory}:${process.env.PATH}`,
        FAKE_DOCKER_LOG: dockerLog
      }

      await runController(['apply', ...sharedArguments], environment)
      const first = JSON.parse(await readFile(join(stateDirectory, 'current.json'), 'utf8'))
      assert.equal(first.manifest.gitSha, gitSha)
      assert.equal(first.databaseRollbackPerformed, false)

      await writeFile(manifestPath, JSON.stringify({ ...manifest, gitSha: 'b'.repeat(40) }))
      await runController(['apply', ...sharedArguments], environment)
      const second = JSON.parse(await readFile(join(stateDirectory, 'current.json'), 'utf8'))
      assert.equal(second.manifest.gitSha, 'b'.repeat(40))
      assert.equal(second.previousReleaseId, first.releaseId)
      assert.match(
        await readFile(join(stateDirectory, 'environments', 'gateway.env'), 'utf8'),
        /RAY_ACTIVE_COLOR=green/
      )

      await writeFile(manifestPath, JSON.stringify({ ...manifest, gitSha: 'c'.repeat(40) }))
      failNextSmoke = true
      await assert.rejects(
        () => runController(['apply', ...sharedArguments], environment),
        /gateway returned to previous color/
      )
      const automaticallyRolledBack = JSON.parse(await readFile(join(stateDirectory, 'current.json'), 'utf8'))
      assert.equal(automaticallyRolledBack.operation, 'rollback')
      assert.equal(automaticallyRolledBack.manifest.gitSha, 'b'.repeat(40))
      assert.equal(automaticallyRolledBack.rolledBackFrom, 'c'.repeat(40))
      const attempts = await readdir(join(stateDirectory, 'attempts'))
      assert.equal(attempts.length, 1)
      const failedAttempt = JSON.parse(await readFile(join(stateDirectory, 'attempts', attempts[0]), 'utf8'))
      assert.equal(failedAttempt.failedStage, 'smoke')
      assert.equal(failedAttempt.candidateColor, 'blue')
      assert.equal(failedAttempt.migrationMode, 'expand')
      assert.equal(failedAttempt.databaseRollbackPerformed, false)

      await writeFile(manifestPath, JSON.stringify({ ...manifest, gitSha: 'd'.repeat(40) }))
      failNextObservation = true
      await assert.rejects(
        () => runController(['apply', ...sharedArguments], environment),
        /gateway returned to previous color/
      )
      const observationRolledBack = JSON.parse(await readFile(join(stateDirectory, 'current.json'), 'utf8'))
      assert.equal(observationRolledBack.manifest.gitSha, 'b'.repeat(40))
      assert.equal(observationRolledBack.rolledBackFrom, 'd'.repeat(40))
      assert.match(
        await readFile(join(stateDirectory, 'environments', 'gateway.env'), 'utf8'),
        /RAY_ACTIVE_COLOR=green/
      )
      const attemptsAfterObservation = await readdir(join(stateDirectory, 'attempts'))
      assert.equal(attemptsAfterObservation.length, 2)
      const failedAttempts = await Promise.all(
        attemptsAfterObservation.map(name => readFile(join(stateDirectory, 'attempts', name), 'utf8').then(JSON.parse))
      )
      assert.equal(
        failedAttempts.find(attempt => attempt.manifest.gitSha === 'd'.repeat(40)).failedStage,
        'observation'
      )

      const commandsBeforeRollback = (await readFile(dockerLog, 'utf8')).trim().split('\n').length
      await runController(
        [
          'rollback',
          '--environment',
          'integration',
          '--smoke-spec',
          smokePath,
          '--runtime-env',
          runtimeEnv,
          '--state-dir',
          stateDirectory,
          '--apply'
        ],
        environment
      )
      const rolledBack = JSON.parse(await readFile(join(stateDirectory, 'current.json'), 'utf8'))
      assert.equal(rolledBack.operation, 'rollback')
      assert.equal(rolledBack.manifest.gitSha, gitSha)
      assert.equal(rolledBack.rolledBackFrom, 'b'.repeat(40))
      assert.equal(rolledBack.databaseRollbackPerformed, false)
      assert.match(await readFile(join(stateDirectory, 'environments', 'gateway.env'), 'utf8'), /RAY_ACTIVE_COLOR=blue/)

      const rollbackCommands = (await readFile(dockerLog, 'utf8')).trim().split('\n').slice(commandsBeforeRollback)
      assert.ok(rollbackCommands.length >= 8)
      assert.ok(rollbackCommands.some(command => command.includes('reload-color.sh')))
      assert.ok(rollbackCommands.some(command => command.includes('stop --timeout')))
      assert.ok(rollbackCommands.every(command => !/migrate|image pull/.test(command)))
    } finally {
      if (server.listening) await close(server)
      await rm(directory, { recursive: true, force: true })
    }
  })
})

describe('deployment composition guardrails', () => {
  it('separates infrastructure from applications and removes mutable deploy entrypoints', async () => {
    const infrastructure = await readFile('docker/compose.infrastructure.yml', 'utf8')
    const application = await readFile('docker/compose.application.yml', 'utf8')
    const gateway = await readFile('docker/compose.gateway.yml', 'utf8')
    const kong = await readFile('docker/kong/kong.yml', 'utf8')
    const kongReload = await readFile('docker/kong/reload-color.sh', 'utf8')
    const controller = await readFile('scripts/deploy/release-controller.mjs', 'utf8')
    const pulseRuntime = await readFile('services/pulse/src/app/pulse-runtime.service.ts', 'utf8')

    assert.match(infrastructure, /^name: ray-infrastructure$/m)
    assert.match(infrastructure, /name: \$\{RAY_NETWORK_NAME/)
    assert.doesNotMatch(infrastructure, /^\s+engine:/m)
    assert.match(application, /external: true/)
    assert.match(application, /ENGINE_IMAGE.*immutable digest/)
    assert.match(gateway, /KONG_ADMIN_LISTEN: 'off'/)
    assert.match(application, /engine-\$\{RAY_COLOR/)
    assert.match(gateway, /RAY_ACTIVE_COLOR/)
    assert.match(application, /http:\/\/127\.0\.0\.1:3001\/health\/ready/)
    assert.match(kong, /url: http:\/\/pulse-\$\{RAY_ACTIVE_COLOR\}:3001/)
    assert.match(kong, /- \/pulse\/socket\.io/)
    assert.match(kongReload, /kong config parse/)
    assert.match(kongReload, /kong reload/)
    assert.match(kongReload, /escape_sed_replacement/)
    assert.match(controller, /stop.*--timeout/s)
    assert.match(controller, /migration mode must be expand or none/)
    assert.match(pulseRuntime, /platform:draining/)
    assert.doesNotMatch(application, /^\s+build:/m)
    assert.doesNotMatch(application, /image: .*latest/)
    assert.doesNotMatch(controller, /git pull|prisma migrate reset|migrate down|npx /)
    assert.match(controller, /apply requires an explicit --apply flag/)
    assert.match(controller, /databaseRollbackPerformed: false/)
    assert.equal(await stat('docker/docker-compose.yml').catch(() => null), null)
    assert.equal(await stat('scripts/deploy.sh').catch(() => null), null)
  })
})
