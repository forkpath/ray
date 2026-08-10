#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFile, chmod, mkdir, open, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const releaseServices = ['engine', 'pulse', 'worker', 'web', 'migrator']

export const applicationServices = ['engine', 'pulse', 'worker', 'web']

const shaPattern = /^[0-9a-f]{40}$/
const digestPattern = /^sha256:[0-9a-f]{64}$/
const imagePattern = /^ghcr\.io\/forkpath\/ray-([a-z0-9-]+)$/
const safeEnvironmentPattern = /^[a-z][a-z0-9-]{1,31}$/
const allowedSmokeMethods = new Set(['GET', 'HEAD'])
const runtimeImageVariables = ['REDIS_IMAGE', 'POSTGRES_IMAGE', 'MONGO_IMAGE', 'RABBITMQ_IMAGE', 'KONG_IMAGE']
const requiredSmokeCategories = new Set(['health', 'auth', 'billing', 'organization'])

const scriptDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)))
const workspaceRoot = resolve(scriptDirectory, '../..')
const applicationComposeFile = join(workspaceRoot, 'docker/compose.application.yml')

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseTimestamp(value, field) {
  const timestamp = Date.parse(value)
  assert(Number.isFinite(timestamp), `${field} must be an ISO timestamp`)
  return timestamp
}

export function validateReleaseManifest(input) {
  assert(isObject(input), 'release manifest must be a JSON object')
  assert(input.schemaVersion === 1, 'release manifest schemaVersion must be 1')
  assert(shaPattern.test(input.gitSha), 'release manifest gitSha is invalid')
  assert(
    input.ref === 'refs/heads/main' || /^refs\/tags\/v[^/]+$/.test(input.ref),
    'release manifest ref must be main or a v* production tag'
  )
  assert(isObject(input.images), 'release manifest images must be an object')

  const names = Object.keys(input.images).sort()
  assert(
    JSON.stringify(names) === JSON.stringify([...releaseServices].sort()),
    `release manifest requires exactly: ${releaseServices.join(', ')}`
  )

  const images = {}
  for (const service of releaseServices) {
    const record = input.images[service]
    assert(isObject(record), `release manifest image ${service} is invalid`)
    assert(imagePattern.test(record.image), `release manifest image ${service} must use GHCR`)
    const imageService = record.image.match(imagePattern)?.[1]
    assert(imageService === service, `release manifest image ${record.image} does not match ${service}`)
    assert(digestPattern.test(record.digest), `release manifest digest ${service} is invalid`)
    images[service] = {
      image: record.image,
      digest: record.digest
    }
  }

  return {
    schemaVersion: 1,
    gitSha: input.gitSha,
    ref: input.ref,
    images
  }
}

export function toImageReference(record) {
  return `${record.image}@${record.digest}`
}

export function validateBackupReceipt(input, { environment, now = Date.now(), maxAgeSeconds = 24 * 60 * 60 }) {
  assert(Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0, 'backup max age must be a positive number')
  assert(isObject(input), 'backup receipt must be a JSON object')
  assert(input.schemaVersion === 1, 'backup receipt schemaVersion must be 1')
  assert(input.environment === environment, 'backup receipt environment mismatch')
  assert(input.status === 'completed', 'backup receipt must be completed')
  assert(typeof input.backupId === 'string' && input.backupId.length > 0, 'backup receipt backupId is required')
  assert(
    typeof input.database === 'string' && input.database.length > 0,
    'backup receipt database fingerprint is required'
  )

  const completedAt = parseTimestamp(input.completedAt, 'backup completedAt')
  assert(completedAt <= now, 'backup receipt cannot be from the future')
  assert(now - completedAt <= maxAgeSeconds * 1000, `backup receipt is older than ${maxAgeSeconds} seconds`)

  return {
    schemaVersion: 1,
    environment,
    status: 'completed',
    backupId: input.backupId,
    database: input.database,
    completedAt: new Date(completedAt).toISOString()
  }
}

export function validateRuntimeImageReferences(content) {
  assert(typeof content === 'string', 'runtime environment must be text')
  const values = new Map()
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (!match) continue
    const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    values.set(match[1], value)
  }

  for (const variable of runtimeImageVariables) {
    const value = values.get(variable)
    assert(value, `runtime environment requires ${variable}`)
    assert(
      /^[a-z0-9][a-z0-9./_-]*@sha256:[0-9a-f]{64}$/.test(value),
      `${variable} must be an immutable image@sha256 reference`
    )
  }

  return Object.fromEntries(runtimeImageVariables.map(variable => [variable, values.get(variable)]))
}

export function validateSmokeSpec(input) {
  assert(isObject(input), 'smoke spec must be a JSON object')
  assert(input.schemaVersion === 1, 'smoke spec schemaVersion must be 1')
  const baseUrl = new URL(input.baseUrl)
  assert(
    baseUrl.protocol === 'https:' ||
      (baseUrl.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(baseUrl.hostname)),
    'smoke baseUrl must use HTTPS except for localhost'
  )
  assert(Array.isArray(input.checks) && input.checks.length > 0, 'smoke checks are required')

  const names = new Set()
  const categories = new Set()
  const checks = input.checks.map(check => {
    assert(isObject(check), 'each smoke check must be an object')
    assert(typeof check.name === 'string' && /^[a-z0-9-]+$/.test(check.name), 'smoke check name must use kebab-case')
    assert(!names.has(check.name), `duplicate smoke check: ${check.name}`)
    names.add(check.name)
    assert(requiredSmokeCategories.has(check.category), `invalid smoke category: ${check.category}`)
    categories.add(check.category)
    assert(
      typeof check.path === 'string' && check.path.startsWith('/') && !check.path.startsWith('//'),
      `smoke check ${check.name} path must be relative`
    )
    const method = check.method ?? 'GET'
    assert(allowedSmokeMethods.has(method), `smoke check ${check.name} method must be GET or HEAD`)
    assert(
      Number.isInteger(check.expectedStatus) && check.expectedStatus >= 100 && check.expectedStatus <= 599,
      `smoke check ${check.name} expectedStatus is invalid`
    )
    const successfulBoundary = check.expectedStatus >= 200 && check.expectedStatus <= 299
    const protectedBoundary = [401, 403].includes(check.expectedStatus)
    assert(
      successfulBoundary || (['billing', 'organization'].includes(check.category) && protectedBoundary),
      `smoke check ${check.name} cannot treat ${check.expectedStatus} as healthy`
    )

    const headersFromEnvironment = check.headersFromEnvironment ?? {}
    assert(isObject(headersFromEnvironment), `smoke check ${check.name} headersFromEnvironment must be an object`)
    for (const [header, variable] of Object.entries(headersFromEnvironment)) {
      assert(/^[A-Za-z0-9-]+$/.test(header), `invalid smoke header: ${header}`)
      assert(
        typeof variable === 'string' && /^[A-Z][A-Z0-9_]+$/.test(variable),
        `invalid environment variable for smoke header ${header}`
      )
    }

    return {
      name: check.name,
      category: check.category,
      path: check.path,
      method,
      expectedStatus: check.expectedStatus,
      headersFromEnvironment
    }
  })

  for (const category of requiredSmokeCategories) {
    assert(categories.has(category), `smoke spec is missing ${category}`)
  }

  const timeoutSeconds = Number.isInteger(input.timeoutSeconds) && input.timeoutSeconds > 0 ? input.timeoutSeconds : 15
  assert(timeoutSeconds <= 15, 'smoke timeoutSeconds must not exceed 15 seconds')

  return {
    schemaVersion: 1,
    baseUrl: baseUrl.toString(),
    timeoutSeconds,
    checks
  }
}

export async function runSmokeChecks(smokeSpec, { fetchImplementation = fetch, environment = process.env } = {}) {
  const spec = validateSmokeSpec(smokeSpec)
  const results = []

  for (const check of spec.checks) {
    const headers = {}
    for (const [header, variable] of Object.entries(check.headersFromEnvironment)) {
      const value = environment[variable]
      assert(value, `smoke check ${check.name} requires ${variable}`)
      headers[header] = value
    }

    const startedAt = Date.now()
    const response = await fetchImplementation(new URL(check.path, spec.baseUrl), {
      method: check.method,
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(spec.timeoutSeconds * 1000)
    })
    assert(
      response.status === check.expectedStatus,
      `smoke check ${check.name} expected ${check.expectedStatus}, received ${response.status}`
    )
    results.push({
      name: check.name,
      category: check.category,
      status: response.status,
      durationMs: Date.now() - startedAt
    })
  }

  return results
}

export function createDeploymentEnvironment({ manifest, runtimeEnvFile, networkName, releaseId }) {
  const normalized = validateReleaseManifest(manifest)
  const lines = [
    `RAY_RELEASE_SHA=${normalized.gitSha}`,
    `RAY_RELEASE_ID=${releaseId}`,
    `RAY_RUNTIME_ENV_FILE=${resolve(runtimeEnvFile)}`,
    `RAY_NETWORK_NAME=${networkName}`
  ]

  for (const service of releaseServices) {
    lines.push(`${service.toUpperCase()}_IMAGE=${toImageReference(normalized.images[service])}`)
  }

  return `${lines.join('\n')}\n`
}

export function buildReleasePlan({ manifest, environment, currentRelease, runtimeImages }) {
  const normalized = validateReleaseManifest(manifest)
  assert(
    typeof runtimeImages?.KONG_IMAGE === 'string' && /@sha256:[0-9a-f]{64}$/.test(runtimeImages.KONG_IMAGE),
    'release plan requires a validated Kong digest'
  )
  return {
    environment,
    gitSha: normalized.gitSha,
    ref: normalized.ref,
    previousReleaseId: currentRelease?.releaseId ?? null,
    operations: [
      { operation: 'verify-runtime-digests' },
      ...releaseServices.map(service => ({
        operation: 'pull',
        service,
        image: toImageReference(normalized.images[service])
      })),
      {
        operation: 'pull',
        service: 'kong',
        image: runtimeImages.KONG_IMAGE
      },
      { operation: 'verify-backup' },
      { operation: 'migrate-forward', command: 'migrate' },
      { operation: 'migrate-forward', command: 'online-migrate' },
      { operation: 'switch-application-digests' },
      { operation: 'wait-readiness' },
      { operation: 'smoke', categories: [...requiredSmokeCategories] },
      { operation: 'record-installed-release' }
    ]
  }
}

export function selectRollbackRelease(releases, currentRelease, toGitSha) {
  const candidates = releases
    .filter(release => release.status === 'installed')
    .filter(release => release.releaseId !== currentRelease.releaseId)
    .filter(release => !currentRelease.manifest?.gitSha || release.manifest.gitSha !== currentRelease.manifest.gitSha)
    .filter(release => !toGitSha || release.manifest.gitSha === toGitSha)
    .sort((left, right) => Date.parse(right.deployedAt) - Date.parse(left.deployedAt))
  const target = candidates[0]
  assert(target, toGitSha ? `no installed release found for ${toGitSha}` : 'no previous installed release found')
  return target
}

function parseArguments(argv) {
  const [command = 'help', ...rest] = argv
  const options = {}
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    assert(token.startsWith('--'), `unexpected argument: ${token}`)
    const separator = token.indexOf('=')
    if (separator > 0) {
      options[token.slice(2, separator)] = token.slice(separator + 1)
      continue
    }
    const key = token.slice(2)
    if (rest[index + 1] && !rest[index + 1].startsWith('--')) {
      options[key] = rest[index + 1]
      index += 1
    } else {
      options[key] = true
    }
  }
  return { command, options }
}

function requireOption(options, name) {
  const value = options[name]
  assert(typeof value === 'string' && value.length > 0, `--${name} is required`)
  return value
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function readOptionalJson(path) {
  try {
    return await readJson(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function assertPrivateRuntimeEnv(path) {
  const metadata = await stat(path)
  assert(metadata.isFile(), 'runtime env must be a regular file')
  assert((metadata.mode & 0o077) === 0, 'runtime env must not be readable or writable by group/others; use chmod 600')
}

async function runCommand(command, args) {
  const printable = [command, ...args].join(' ')
  process.stdout.write(`[release-controller] run ${printable}\n`)
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: 'inherit' })
    child.once('error', rejectPromise)
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise()
      rejectPromise(new Error(`${command} failed with ${signal ? `signal ${signal}` : `code ${code}`}`))
    })
  })
}

function composeArguments(context, environmentFile) {
  return [
    'compose',
    '--project-name',
    `ray-${context.environment}`,
    '--env-file',
    context.runtimeEnvFile,
    '--env-file',
    environmentFile,
    '-f',
    applicationComposeFile
  ]
}

async function pullReleaseImages(context) {
  for (const service of releaseServices) {
    await runCommand('docker', ['image', 'pull', toImageReference(context.manifest.images[service])])
  }
  await runCommand('docker', ['image', 'pull', context.runtimeImages.KONG_IMAGE])
}

async function runMigrator(context, command) {
  await runCommand('docker', [
    'run',
    '--rm',
    '--network',
    context.networkName,
    '--env-file',
    context.runtimeEnvFile,
    toImageReference(context.manifest.images.migrator),
    command
  ])
}

async function switchApplication(context, environmentFile) {
  await runCommand('docker', [
    ...composeArguments(context, environmentFile),
    'up',
    '-d',
    '--no-build',
    '--pull',
    'never',
    '--remove-orphans',
    '--wait',
    '--wait-timeout',
    String(context.readinessTimeoutSeconds)
  ])
}

async function listInstalledReleases(stateDirectory) {
  const releaseDirectory = join(stateDirectory, 'releases')
  let names = []
  try {
    names = await readdir(releaseDirectory)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const releases = await Promise.all(
    names.filter(name => name.endsWith('.json')).map(name => readJson(join(releaseDirectory, name)))
  )
  return releases
}

async function writeAtomicJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600
  })
  await rename(temporary, path)
}

async function appendHistory(stateDirectory, event) {
  await appendFile(join(stateDirectory, 'history.jsonl'), `${JSON.stringify(event)}\n`, { mode: 0o600 })
}

async function recordRelease(stateDirectory, release) {
  const releaseDirectory = join(stateDirectory, 'releases')
  await mkdir(releaseDirectory, { recursive: true, mode: 0o700 })
  const releasePath = join(releaseDirectory, `${release.releaseId}.json`)
  await writeAtomicJson(releasePath, release)
  await writeAtomicJson(join(stateDirectory, 'current.json'), release)
  await appendHistory(stateDirectory, release)
}

async function recordFailedAttempt(stateDirectory, attempt) {
  const attemptDirectory = join(stateDirectory, 'attempts')
  await mkdir(attemptDirectory, { recursive: true, mode: 0o700 })
  await writeAtomicJson(join(attemptDirectory, `${attempt.operationId}.json`), attempt)
  await appendHistory(stateDirectory, attempt)
}

async function writeEnvironmentFile(context, manifest, releaseId) {
  const environmentDirectory = join(context.stateDirectory, 'environments')
  await mkdir(environmentDirectory, { recursive: true, mode: 0o700 })
  const path = join(environmentDirectory, `${releaseId}.env`)
  await writeFile(
    path,
    createDeploymentEnvironment({
      manifest,
      runtimeEnvFile: context.runtimeEnvFile,
      networkName: context.networkName,
      releaseId
    }),
    { mode: 0o600 }
  )
  await chmod(path, 0o600)
  return path
}

async function acquireLock(stateDirectory, operationId) {
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 })
  const lockPath = join(stateDirectory, 'deployment.lock')
  let handle
  try {
    handle = await open(lockPath, 'wx', 0o600)
    await handle.writeFile(
      `${JSON.stringify({ operationId, pid: process.pid, createdAt: new Date().toISOString() })}\n`
    )
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`deployment lock exists at ${lockPath}; inspect it before manual removal`)
    }
    throw error
  } finally {
    await handle?.close()
  }
  return async () => rm(lockPath, { force: true })
}

async function rollbackApplication(context, target, smokeSpec, reason, rolledBackFrom) {
  const operationId = randomUUID()
  const startedAt = Date.now()
  const releaseId = `${target.manifest.gitSha}-${operationId}`
  const environmentFile = await writeEnvironmentFile(context, target.manifest, releaseId)
  await switchApplication(context, environmentFile)
  const smokeResults = await runSmokeChecks(smokeSpec)
  const current = await readOptionalJson(join(context.stateDirectory, 'current.json'))
  const release = {
    schemaVersion: 1,
    releaseId,
    operation: 'rollback',
    environment: context.environment,
    status: 'installed',
    manifest: target.manifest,
    deployedAt: new Date().toISOString(),
    previousReleaseId: current?.releaseId ?? null,
    rolledBackFrom: rolledBackFrom ?? current?.manifest?.gitSha ?? null,
    reason,
    smokeResults,
    durationSeconds: Math.ceil((Date.now() - startedAt) / 1000),
    databaseRollbackPerformed: false
  }
  await recordRelease(context.stateDirectory, release)
  return release
}

async function applyRelease(context, backupReceipt, smokeSpec) {
  const operationId = randomUUID()
  const releaseId = `${context.manifest.gitSha}-${operationId}`
  const releaseEnvironmentFile = await writeEnvironmentFile(context, context.manifest, releaseId)
  const previous = await readOptionalJson(join(context.stateDirectory, 'current.json'))
  let applicationSwitchStarted = false
  let stage = 'pull-images'

  try {
    await pullReleaseImages(context)
    process.stdout.write(`[release-controller] backup ${backupReceipt.backupId} verified\n`)
    stage = 'migrate'
    await runMigrator(context, 'migrate')
    stage = 'online-migrate'
    await runMigrator(context, 'online-migrate')
    applicationSwitchStarted = true
    stage = 'switch-application'
    await switchApplication(context, releaseEnvironmentFile)
    stage = 'smoke'
    const smokeResults = await runSmokeChecks(smokeSpec)
    const release = {
      schemaVersion: 1,
      releaseId,
      operation: 'deploy',
      environment: context.environment,
      status: 'installed',
      manifest: context.manifest,
      deployedAt: new Date().toISOString(),
      previousReleaseId: previous?.releaseId ?? null,
      backup: backupReceipt,
      smokeResults,
      databaseRollbackPerformed: false
    }
    stage = 'record-release'
    await recordRelease(context.stateDirectory, release)
    return release
  } catch (error) {
    try {
      await recordFailedAttempt(context.stateDirectory, {
        schemaVersion: 1,
        operationId,
        operation: 'deploy',
        environment: context.environment,
        status: 'failed',
        manifest: context.manifest,
        failedAt: new Date().toISOString(),
        failedStage: stage,
        previousReleaseId: previous?.releaseId ?? null,
        backup: backupReceipt,
        error: error instanceof Error ? error.message : String(error),
        databaseRollbackPerformed: false
      })
    } catch (recordError) {
      process.stderr.write(
        `[release-controller] could not record failed attempt: ${
          recordError instanceof Error ? recordError.message : String(recordError)
        }\n`
      )
    }
    if (applicationSwitchStarted && previous?.status === 'installed') {
      try {
        await rollbackApplication(
          context,
          previous,
          smokeSpec,
          `automatic rollback after failed deploy ${context.manifest.gitSha}`,
          context.manifest.gitSha
        )
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          'release failed and automatic application rollback also failed'
        )
      }
      throw new Error(`release failed; previous application digests were restored: ${error.message}`, { cause: error })
    }
    throw error
  }
}

async function buildContext(options) {
  const environment = requireOption(options, 'environment')
  assert(safeEnvironmentPattern.test(environment), '--environment must be a safe lowercase identifier')
  const runtimeEnvFile = resolve(requireOption(options, 'runtime-env'))
  await assertPrivateRuntimeEnv(runtimeEnvFile)
  const runtimeImages = validateRuntimeImageReferences(await readFile(runtimeEnvFile, 'utf8'))
  const stateDirectory = resolve(options['state-dir'] ?? `/var/lib/ray/releases/${environment}`)
  const networkName = options.network ?? `ray-${environment}-platform`
  assert(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,62}$/.test(networkName), '--network is not a safe Docker network name')
  const readinessTimeoutSeconds = Number(options['readiness-timeout'] ?? 180)
  assert(
    Number.isInteger(readinessTimeoutSeconds) && readinessTimeoutSeconds > 0 && readinessTimeoutSeconds <= 180,
    '--readiness-timeout must be an integer between 1 and 180'
  )
  return {
    environment,
    runtimeEnvFile,
    runtimeImages,
    stateDirectory,
    networkName,
    readinessTimeoutSeconds
  }
}

function printUsage() {
  process.stdout.write(`Usage:
  node scripts/deploy/release-controller.mjs plan \\
    --manifest release.json --backup-receipt backup.json \\
    --smoke-spec smoke.json --runtime-env /secure/runtime.env \\
    --environment production [--state-dir /var/lib/ray/releases/production]

  node scripts/deploy/release-controller.mjs apply [same options] --apply

  node scripts/deploy/release-controller.mjs rollback \\
    --smoke-spec smoke.json --runtime-env /secure/runtime.env \\
    --environment production [--to-git-sha <sha>] --apply

  node scripts/deploy/release-controller.mjs status \\
    --environment production [--state-dir /var/lib/ray/releases/production]

The controller never builds source, pulls Git, or reverses database DDL.
`)
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2))
  if (command === 'help' || options.help) return printUsage()

  if (command === 'status') {
    const environment = requireOption(options, 'environment')
    assert(safeEnvironmentPattern.test(environment), '--environment must be a safe lowercase identifier')
    const stateDirectory = resolve(options['state-dir'] ?? `/var/lib/ray/releases/${environment}`)
    const current = await readOptionalJson(join(stateDirectory, 'current.json'))
    process.stdout.write(`${JSON.stringify(current, null, 2)}\n`)
    return
  }

  const context = await buildContext(options)
  const smokeSpec = validateSmokeSpec(await readJson(resolve(requireOption(options, 'smoke-spec'))))

  if (command === 'plan' || command === 'apply') {
    context.manifest = validateReleaseManifest(await readJson(resolve(requireOption(options, 'manifest'))))
    const backupReceipt = validateBackupReceipt(await readJson(resolve(requireOption(options, 'backup-receipt'))), {
      environment: context.environment,
      maxAgeSeconds: Number(options['backup-max-age'] ?? 24 * 60 * 60)
    })
    const current = await readOptionalJson(join(context.stateDirectory, 'current.json'))
    const plan = buildReleasePlan({
      manifest: context.manifest,
      environment: context.environment,
      currentRelease: current,
      runtimeImages: context.runtimeImages
    })
    if (command === 'plan') {
      process.stdout.write(`${JSON.stringify({ plan, backupReceipt }, null, 2)}\n`)
      return
    }

    assert(options.apply === true, 'apply requires an explicit --apply flag')
    const releaseLock = await acquireLock(context.stateDirectory, randomUUID())
    try {
      const release = await applyRelease(context, backupReceipt, smokeSpec)
      process.stdout.write(`${JSON.stringify(release, null, 2)}\n`)
    } finally {
      await releaseLock()
    }
    return
  }

  if (command === 'rollback') {
    assert(options.apply === true, 'rollback requires an explicit --apply flag')
    const current = await readOptionalJson(join(context.stateDirectory, 'current.json'))
    assert(current?.status === 'installed', 'no installed current release found')
    assert(current.environment === context.environment, 'installed release environment mismatch')
    validateReleaseManifest(current.manifest)
    const toGitSha = options['to-git-sha']
    if (toGitSha) assert(shaPattern.test(toGitSha), '--to-git-sha is invalid')
    const releases = await listInstalledReleases(context.stateDirectory)
    const target = selectRollbackRelease(releases, current, toGitSha)
    assert(target.environment === context.environment, 'rollback target environment mismatch')
    context.manifest = validateReleaseManifest(target.manifest)

    const releaseLock = await acquireLock(context.stateDirectory, randomUUID())
    try {
      const release = await rollbackApplication(
        context,
        target,
        smokeSpec,
        `operator rollback from ${current.manifest.gitSha}`,
        current.manifest.gitSha
      )
      process.stdout.write(`${JSON.stringify(release, null, 2)}\n`)
      if (release.durationSeconds > 300) {
        throw new Error(`rollback exceeded the 300 second RTO: ${release.durationSeconds}s`)
      }
    } finally {
      await releaseLock()
    }
    return
  }

  throw new Error(`unknown command: ${command}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`[release-controller] failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
