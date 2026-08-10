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
  runSmokeChecks,
  selectRollbackRelease,
  toImageReference,
  validateBackupReceipt,
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
      releaseId: `${gitSha}-operation`
    })
    assert.match(environmentFile, /ENGINE_IMAGE=ghcr\.io\/forkpath\/ray-engine@sha256:/)
    assert.match(environmentFile, /MIGRATOR_IMAGE=ghcr\.io\/forkpath\/ray-migrator@sha256:/)
    assert.match(environmentFile, /RAY_RUNTIME_ENV_FILE=\/secure\/runtime\.env/)
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
})

describe('forward-only release and rollback plan', () => {
  it('migrates before switching and records the installed release last', () => {
    const plan = buildReleasePlan({
      manifest,
      environment: 'production',
      currentRelease: { releaseId: 'previous' },
      runtimeImages: { KONG_IMAGE: `kong@${digest('e')}` }
    })
    const operations = plan.operations.map(item => item.operation)
    const migrationIndex = operations.indexOf('migrate-forward')
    const switchIndex = operations.indexOf('switch-application-digests')
    assert.ok(migrationIndex < switchIndex)
    assert.equal(operations.at(-1), 'record-installed-release')
    assert.equal(plan.previousReleaseId, 'previous')
    assert.equal(plan.operations.find(item => item.service === 'kong').image, `kong@${digest('e')}`)
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
    const stateDirectory = join(directory, 'state')
    const dockerLog = join(directory, 'docker.log')
    const fakeDocker = join(binDirectory, 'docker')
    let failNextSmoke = false
    const server = createServer((request, response) => {
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

      const sharedArguments = [
        '--environment',
        'integration',
        '--manifest',
        manifestPath,
        '--backup-receipt',
        backupPath,
        '--smoke-spec',
        smokePath,
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

      await writeFile(manifestPath, JSON.stringify({ ...manifest, gitSha: 'c'.repeat(40) }))
      failNextSmoke = true
      await assert.rejects(
        () => runController(['apply', ...sharedArguments], environment),
        /previous application digests were restored/
      )
      const automaticallyRolledBack = JSON.parse(await readFile(join(stateDirectory, 'current.json'), 'utf8'))
      assert.equal(automaticallyRolledBack.operation, 'rollback')
      assert.equal(automaticallyRolledBack.manifest.gitSha, 'b'.repeat(40))
      assert.equal(automaticallyRolledBack.rolledBackFrom, 'c'.repeat(40))
      const attempts = await readdir(join(stateDirectory, 'attempts'))
      assert.equal(attempts.length, 1)
      const failedAttempt = JSON.parse(await readFile(join(stateDirectory, 'attempts', attempts[0]), 'utf8'))
      assert.equal(failedAttempt.failedStage, 'smoke')
      assert.equal(failedAttempt.databaseRollbackPerformed, false)

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

      const rollbackCommands = (await readFile(dockerLog, 'utf8')).trim().split('\n').slice(commandsBeforeRollback)
      assert.equal(rollbackCommands.length, 1)
      assert.match(rollbackCommands[0], /^compose /)
      assert.doesNotMatch(rollbackCommands[0], /migrate|image pull/)
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
    const controller = await readFile('scripts/deploy/release-controller.mjs', 'utf8')

    assert.match(infrastructure, /^name: ray-infrastructure$/m)
    assert.match(infrastructure, /name: \$\{RAY_NETWORK_NAME/)
    assert.doesNotMatch(infrastructure, /^\s+engine:/m)
    assert.match(application, /external: true/)
    assert.match(application, /ENGINE_IMAGE.*immutable digest/)
    assert.match(application, /KONG_ADMIN_LISTEN: 'off'/)
    assert.doesNotMatch(application, /^\s+build:/m)
    assert.doesNotMatch(application, /image: .*latest/)
    assert.doesNotMatch(controller, /git pull|prisma migrate reset|migrate down|npx /)
    assert.match(controller, /apply requires an explicit --apply flag/)
    assert.match(controller, /databaseRollbackPerformed: false/)
    assert.equal(await stat('docker/docker-compose.yml').catch(() => null), null)
    assert.equal(await stat('scripts/deploy.sh').catch(() => null), null)
  })
})
