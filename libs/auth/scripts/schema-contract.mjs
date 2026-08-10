import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
export const workspaceRoot = resolve(scriptDirectory, '../../..')
export const trackedSchemaPath = join(workspaceRoot, 'libs/pg-dao/src/models/auth.prisma')
export const policyPath = join(workspaceRoot, 'libs/auth/auth-schema-policy.json')
const toolingPackagePath = join(workspaceRoot, 'tools/auth-schema-tooling/package.json')
const toolingRequire = createRequire(toolingPackagePath)
const { getSchema } = toolingRequire('@mrleebo/prisma-ast')
const tsconfigPathsRegisterPath = toolingRequire.resolve('tsconfig-paths/register')

const logicalAttributeExclusions = new Set(['map', 'schema'])
const scalarTypes = new Set(['BigInt', 'Boolean', 'Bytes', 'DateTime', 'Decimal', 'Float', 'Int', 'Json', 'String'])

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['comment', 'kind', 'type'].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, stableValue(nestedValue)])
  )
}

function normalizeAttribute(attribute) {
  return {
    name: attribute.name,
    group: attribute.group ?? null,
    args: stableValue(attribute.args ?? [])
  }
}

function normalizeField(field) {
  return {
    name: field.name,
    fieldType: stableValue(field.fieldType),
    array: field.array,
    optional: field.optional,
    attributes: (field.attributes ?? [])
      .filter(attribute => !logicalAttributeExclusions.has(attribute.name))
      .map(normalizeAttribute)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  }
}

function modelNodes(schemaText) {
  return getSchema(schemaText).list.filter(node => node.type === 'model')
}

function modelAttributes(model) {
  return model.properties
    .filter(property => property.type === 'attribute')
    .filter(attribute => !logicalAttributeExclusions.has(attribute.name))
    .map(normalizeAttribute)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
}

function fieldNodes(model) {
  return model.properties.filter(property => property.type === 'field')
}

function attributeString(attributes, name) {
  const attribute = attributes?.find(item => item.name === name)
  const value = attribute?.args?.[0]?.value

  if (typeof value !== 'string') {
    return undefined
  }

  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

export function toSnakeCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}

export function assertVersionAlignment(packageJson, toolingPackageJson) {
  const versions = {
    'better-auth': packageJson.dependencies?.['better-auth'],
    '@better-auth/expo': packageJson.dependencies?.['@better-auth/expo'],
    '@better-auth/passkey': packageJson.dependencies?.['@better-auth/passkey'],
    auth: toolingPackageJson.devDependencies?.auth
  }

  for (const [packageName, version] of Object.entries(versions)) {
    assert.match(version ?? '', /^\d+\.\d+\.\d+$/, `${packageName} must use an exact semantic version`)
  }

  const uniqueVersions = new Set(Object.values(versions))
  assert.equal(
    uniqueVersions.size,
    1,
    `Better Auth runtime, plugins and CLI must share one version: ${JSON.stringify(versions)}`
  )

  return versions.auth
}

export function evaluateContracts({ candidateText, trackedText, policy }) {
  const errors = []
  const candidateModels = new Map(modelNodes(candidateText).map(model => [model.name, model]))
  const trackedModels = new Map(modelNodes(trackedText).map(model => [model.name, model]))
  const policyModels = policy.models ?? {}

  for (const modelName of candidateModels.keys()) {
    if (!trackedModels.has(modelName)) {
      errors.push(`logical: tracked schema is missing model ${modelName}`)
    }
    if (!policyModels[modelName]) {
      errors.push(`policy: model ${modelName} has no physical contract entry`)
    }
  }

  for (const modelName of trackedModels.keys()) {
    if (!candidateModels.has(modelName)) {
      errors.push(`logical: tracked schema has unexpected model ${modelName}`)
    }
  }

  for (const modelName of Object.keys(policyModels)) {
    if (!candidateModels.has(modelName)) {
      errors.push(`policy: ${modelName} does not exist in the Better Auth candidate`)
    }
  }

  for (const [modelName, candidateModel] of candidateModels) {
    const trackedModel = trackedModels.get(modelName)
    const modelPolicy = policyModels[modelName]
    if (!trackedModel || !modelPolicy) {
      continue
    }

    const candidateFields = new Map(fieldNodes(candidateModel).map(field => [field.name, normalizeField(field)]))
    const trackedFields = new Map(fieldNodes(trackedModel).map(field => [field.name, normalizeField(field)]))
    const allowedAdditionalFields = new Set(modelPolicy.allowedAdditionalFields ?? [])

    for (const fieldName of allowedAdditionalFields) {
      if (candidateFields.has(fieldName) || !trackedFields.has(fieldName)) {
        errors.push(`policy: ${modelName}.${fieldName} is not a tracked-only local extension`)
      }
    }

    for (const [fieldName, candidateField] of candidateFields) {
      const trackedField = trackedFields.get(fieldName)
      if (!trackedField) {
        errors.push(`logical: ${modelName}.${fieldName} is missing from tracked schema`)
        continue
      }
      if (JSON.stringify(candidateField) !== JSON.stringify(trackedField)) {
        errors.push(
          `logical: ${modelName}.${fieldName} differs\n` +
            `  candidate=${JSON.stringify(candidateField)}\n` +
            `  tracked=${JSON.stringify(trackedField)}`
        )
      }
    }

    for (const fieldName of trackedFields.keys()) {
      if (!candidateFields.has(fieldName) && !allowedAdditionalFields.has(fieldName)) {
        errors.push(`logical: ${modelName}.${fieldName} is a local extension but is not whitelisted`)
      }
    }

    if (JSON.stringify(modelAttributes(candidateModel)) !== JSON.stringify(modelAttributes(trackedModel))) {
      errors.push(`logical: indexes or model constraints differ for ${modelName}`)
    }

    const trackedObjectAttributes = trackedModel.properties.filter(property => property.type === 'attribute')
    const actualSchema = attributeString(trackedObjectAttributes, 'schema')
    if (actualSchema !== policy.databaseSchema) {
      errors.push(`physical: ${modelName} must use @@schema(${JSON.stringify(policy.databaseSchema)})`)
    }

    const actualTable = attributeString(trackedObjectAttributes, 'map')
    if (actualTable !== modelPolicy.table) {
      errors.push(
        `physical: ${modelName} table must map to ${JSON.stringify(modelPolicy.table)}, got ${JSON.stringify(actualTable)}`
      )
    }

    for (const field of fieldNodes(trackedModel)) {
      if (!scalarTypes.has(field.fieldType)) {
        continue
      }

      const expectedColumn = toSnakeCase(field.name)
      const actualColumn = attributeString(field.attributes, 'map')
      if (expectedColumn === field.name && actualColumn !== undefined) {
        errors.push(`physical: ${modelName}.${field.name} has an unnecessary @map`)
      } else if (expectedColumn !== field.name && actualColumn !== expectedColumn) {
        errors.push(
          `physical: ${modelName}.${field.name} must map to ${JSON.stringify(expectedColumn)}, got ${JSON.stringify(actualColumn)}`
        )
      }
    }
  }

  return {
    status: errors.length === 0 ? 'clean' : 'drift',
    candidateModelCount: candidateModels.size,
    trackedModelCount: trackedModels.size,
    errors
  }
}

export function safeEnvironment(environment = process.env) {
  const inheritedEnvironment = Object.fromEntries(
    ['CI', 'FORCE_COLOR', 'NO_COLOR', 'PATH', 'TEMP', 'TERM', 'TMP', 'TMPDIR']
      .filter(name => environment[name] !== undefined)
      .map(name => [name, environment[name]])
  )

  return {
    ...inheritedEnvironment,
    NODE_OPTIONS: `--require=${tsconfigPathsRegisterPath}`,
    NODE_ENV: 'development',
    POSTGRES_DATABASE_URL: 'postgresql://schema_check:schema_check@127.0.0.1:1/schema_check',
    POSGTRES_DATABASE_URL: '',
    BETTER_AUTH_SECRET: 'schema-check-placeholder-secret-at-least-32-characters',
    BETTER_AUTH_URL: 'http://localhost:3000',
    EMAIL_FROM: 'schema-check@example.invalid',
    RESEND_API_KEY: 'schema-check-placeholder',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    GITHUB_CLIENT_ID: '',
    GITHUB_CLIENT_SECRET: '',
    AUTH_APPLE_CLIENT_ID: '',
    AUTH_APPLE_CLIENT_SECRET: '',
    AUTH_APPLE_APP_BUNDLE_IDENTIFIER: ''
  }
}

function generateCandidate(outputPath) {
  const cliPath = join(workspaceRoot, 'node_modules/auth/dist/index.mjs')
  execFileSync(
    process.execPath,
    [cliPath, 'generate', '--config', 'libs/auth/src/server.ts', '--output', outputPath, '--yes'],
    {
      cwd: workspaceRoot,
      env: safeEnvironment(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024
    }
  )
}

function run() {
  const command = process.argv[2] ?? 'check'
  if (!['check', 'update'].includes(command)) {
    throw new Error('Usage: schema-contract.mjs <check|update>')
  }

  const packageJson = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'))
  const toolingPackageJson = JSON.parse(readFileSync(toolingPackagePath, 'utf8'))
  const version = assertVersionAlignment(packageJson, toolingPackageJson)
  const installedCliPackageJson = JSON.parse(
    readFileSync(join(workspaceRoot, 'node_modules/auth/package.json'), 'utf8')
  )
  assert.equal(installedCliPackageJson.version, version, 'installed Better Auth CLI version must match package policy')
  const trackedText = readFileSync(trackedSchemaPath, 'utf8')
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'))
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'ray-auth-schema-'))
  const candidatePath =
    command === 'check'
      ? join(temporaryDirectory, 'auth.prisma')
      : join(workspaceRoot, 'tmp/auth-schema-candidate/auth.prisma')

  if (resolve(candidatePath) === resolve(trackedSchemaPath)) {
    throw new Error('schema-update cannot overwrite the tracked physical schema')
  }

  try {
    mkdirSync(dirname(candidatePath), { recursive: true })
    generateCandidate(candidatePath)
    const candidateText = readFileSync(candidatePath, 'utf8')
    const report = {
      betterAuthVersion: version,
      generatedAt: command === 'update' ? new Date().toISOString() : undefined,
      ...evaluateContracts({ candidateText, trackedText, policy })
    }

    if (command === 'update') {
      const reportPath = `${candidatePath}.report.json`
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
      console.log(`[auth-schema] candidate: ${relative(workspaceRoot, candidatePath)}`)
      console.log(`[auth-schema] report: ${relative(workspaceRoot, reportPath)}`)
      console.log('[auth-schema] tracked schema was not modified; review and create a Prisma migration manually')
    }

    if (report.errors.length > 0) {
      console.error(`[auth-schema] ${report.errors.length} contract error(s):`)
      for (const error of report.errors) {
        console.error(`- ${error}`)
      }
      process.exitCode = 1
      return
    }

    console.log(`[auth-schema] clean: Better Auth ${version}, ${report.candidateModelCount} governed models`)
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  run()
}
