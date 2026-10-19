/**
 * Better Auth schema drift gate.
 *
 * The CLI owns the logical auth contract while auth.prisma owns physical
 * PostgreSQL names. This comparer intentionally ignores @map/@@map/@@schema,
 * but compares fields, types, defaults, relations, indexes and unique keys.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const workspaceRoot = resolve(import.meta.dirname, '../..')
const toolRoot = join(workspaceRoot, 'tools/auth-schema')
const runtimeManifest = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf8'))
const toolManifest = JSON.parse(readFileSync(join(toolRoot, 'package.json'), 'utf8'))
const runtimeVersion = runtimeManifest.dependencies['better-auth']
if (toolManifest.devDependencies.auth !== runtimeVersion) {
  throw new Error('Pin the auth CLI to the same exact version as the Better Auth runtime before checking schemas.')
}
// Mixed Better Auth package versions resolve two @better-auth/core copies and
// break plugin type inference, so every @better-auth/* runtime package must
// match better-auth exactly.
const mismatchedPackages = Object.entries(runtimeManifest.dependencies)
  .filter(([name, version]) => name.startsWith('@better-auth/') && version !== runtimeVersion)
  .map(([name, version]) => `${name}@${version}`)
if (mismatchedPackages.length > 0) {
  throw new Error(
    `Pin every @better-auth/* package to better-auth@${runtimeVersion}; mismatched: ${mismatchedPackages.join(', ')}`
  )
}
const canonicalPath = join(workspaceRoot, 'libs/pg-dao/src/models/auth.prisma')
const authProjectRoot = join(workspaceRoot, 'libs/auth-server')
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'ray-auth-schema-'))
const candidatePath = join(temporaryDirectory, 'auth.prisma')

// Project-owned relations and indexes are intentionally absent from Better
// Auth's generated schema. Keep this list narrow and review every addition.
const localSchemaExtensions = {
  'model:User': new Set(['billingCustomers Customer[] @relation("UserBillingCustomers")']),
  'model:Organization': new Set(['billingCustomers Customer[] @relation("OrganizationBillingCustomers")']),
  'model:Member': new Set(['@@unique([organizationId, userId], map: "member_organization_user_unique")']),
  'model:OrganizationRole': new Set([
    '@@unique([organizationId, role], map: "organization_role_organization_role_unique")'
  ]),
  'model:Invitation': new Set([
    '@@index([organizationId, status], map: "invitation_organization_status_idx")',
    '@@index([email, status], map: "invitation_email_status_idx")'
  ])
}

function normalizeAttribute(value) {
  return value
    .replace(/\s+@map\("[^"]+"\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseSchema(source) {
  const blocks = new Map()
  const blockPattern = /\b(model|enum)\s+(\w+)\s*\{/g
  let match

  while ((match = blockPattern.exec(source)) !== null) {
    let cursor = blockPattern.lastIndex
    let depth = 1

    while (cursor < source.length && depth > 0) {
      if (source[cursor] === '{') depth += 1
      if (source[cursor] === '}') depth -= 1
      cursor += 1
    }

    if (depth !== 0) {
      throw new Error(`Unclosed ${match[1]} block: ${match[2]}`)
    }

    const body = source.slice(blockPattern.lastIndex, cursor - 1)
    const block = `${match[1]}:${match[2]}`
    const extensions = localSchemaExtensions[block] ?? new Set()
    const entries = body
      .split('\n')
      .map(line => line.replace(/\/\/.*$/, '').trim())
      .filter(Boolean)
      .filter(line => !line.startsWith('@@map(') && !line.startsWith('@@schema('))
      .map(normalizeAttribute)
      .filter(line => !extensions.has(line))
      .sort()

    blocks.set(block, entries)
    blockPattern.lastIndex = cursor
  }

  return Object.fromEntries([...blocks.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

function formatDifference(canonical, candidate) {
  const allBlocks = [...new Set([...Object.keys(canonical), ...Object.keys(candidate)])].sort()
  const differences = []

  for (const block of allBlocks) {
    const expected = canonical[block] ?? []
    const actual = candidate[block] ?? []

    if (JSON.stringify(expected) === JSON.stringify(actual)) continue

    differences.push(`\n${block}`)
    differences.push(`  canonical: ${JSON.stringify(expected, null, 2).replaceAll('\n', '\n  ')}`)
    differences.push(`  generated: ${JSON.stringify(actual, null, 2).replaceAll('\n', '\n  ')}`)
  }

  return differences.join('\n')
}

try {
  execFileSync(
    'pnpm',
    [
      '--dir',
      toolRoot,
      'exec',
      'auth',
      'generate',
      '--cwd',
      authProjectRoot,
      '--config',
      'src/lib/auth-server.ts',
      '--output',
      candidatePath,
      '--yes'
    ],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        NODE_OPTIONS: '-r tsconfig-paths/register',
        TS_NODE_PROJECT: join(workspaceRoot, 'tsconfig.base.json'),
        POSTGRES_DATABASE_URL: 'postgresql://schema:check@127.0.0.1:1/schema_check',
        POSGTRES_DATABASE_URL: undefined,
        BETTER_AUTH_SECRET: 'auth-schema-check-secret-32-characters-minimum',
        BETTER_AUTH_URL: 'https://auth-schema.example.test',
        EMAIL_FROM: 'noreply@example.test',
        RESEND_API_KEY: 're_auth_schema_check',
        GOOGLE_CLIENT_ID: 'google-schema-check',
        GOOGLE_CLIENT_SECRET: 'google-schema-check-secret',
        GITHUB_CLIENT_ID: 'github-schema-check',
        GITHUB_CLIENT_SECRET: 'github-schema-check-secret',
        AUTH_APPLE_CLIENT_ID: 'apple-schema-check',
        AUTH_APPLE_CLIENT_SECRET: 'apple-schema-check-secret',
        AUTH_APPLE_APP_BUNDLE_IDENTIFIER: 'dev.ray.schema-check'
      },
      stdio: 'inherit'
    }
  )

  const canonical = parseSchema(readFileSync(canonicalPath, 'utf8'))
  const candidate = parseSchema(readFileSync(candidatePath, 'utf8'))
  const difference = formatDifference(canonical, candidate)

  if (difference) {
    console.error('Better Auth logical schema drift detected:')
    console.error(difference)
    process.exitCode = 1
  } else {
    console.log('Better Auth logical schema matches the governed Prisma schema.')
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
