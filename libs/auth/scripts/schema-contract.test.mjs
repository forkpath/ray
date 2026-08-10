import assert from 'node:assert/strict'
import test from 'node:test'

import { assertVersionAlignment, evaluateContracts, safeEnvironment, toSnakeCase } from './schema-contract.mjs'

const candidate = `
model User {
  id        String @id
  createdAt DateTime @default(now())

  @@map("user")
}
`

const tracked = `
model User {
  id        String @id
  createdAt DateTime @default(now()) @map("created_at")

  @@map("user")
  @@schema("public")
}
`

const policy = {
  databaseSchema: 'public',
  models: {
    User: {
      table: 'user',
      allowedAdditionalFields: []
    }
  }
}

test('accepts physical mappings while comparing the logical contract', () => {
  assert.deepEqual(evaluateContracts({ candidateText: candidate, trackedText: tracked, policy }), {
    status: 'clean',
    candidateModelCount: 1,
    trackedModelCount: 1,
    errors: []
  })
})

test('requires local extensions to be explicitly whitelisted', () => {
  const extendedTracked = tracked.replace(
    'createdAt DateTime',
    'billingId String? @map("billing_id")\n  createdAt DateTime'
  )
  const report = evaluateContracts({
    candidateText: candidate,
    trackedText: extendedTracked,
    policy
  })

  assert.equal(report.status, 'drift')
  assert.match(report.errors.join('\n'), /User\.billingId is a local extension/)

  const allowedReport = evaluateContracts({
    candidateText: candidate,
    trackedText: extendedTracked,
    policy: {
      ...policy,
      models: {
        User: {
          ...policy.models.User,
          allowedAdditionalFields: ['billingId']
        }
      }
    }
  })
  assert.equal(allowedReport.status, 'clean')

  const stalePolicyReport = evaluateContracts({
    candidateText: candidate,
    trackedText: tracked,
    policy: {
      ...policy,
      models: {
        User: {
          ...policy.models.User,
          allowedAdditionalFields: ['missingField']
        }
      }
    }
  })
  assert.match(stalePolicyReport.errors.join('\n'), /missingField is not a tracked-only local extension/)
})

test('detects logical drift and physical mapping drift independently', () => {
  const driftedTracked = tracked
    .replace('createdAt DateTime', 'createdAt DateTime?')
    .replace('@map("created_at")', '@map("createdAt")')
  const report = evaluateContracts({
    candidateText: candidate,
    trackedText: driftedTracked,
    policy
  })

  assert.equal(report.status, 'drift')
  assert.match(report.errors.join('\n'), /logical: User\.createdAt differs/)
  assert.match(report.errors.join('\n'), /physical: User\.createdAt must map to "created_at"/)
})

test('requires exact and aligned Better Auth package versions', () => {
  const packageJson = {
    dependencies: {
      'better-auth': '1.6.26',
      '@better-auth/expo': '1.6.26',
      '@better-auth/passkey': '1.6.26'
    }
  }
  const toolingPackageJson = { devDependencies: { auth: '1.6.26' } }

  assert.equal(assertVersionAlignment(packageJson, toolingPackageJson), '1.6.26')
  assert.throws(
    () =>
      assertVersionAlignment(
        {
          ...packageJson
        },
        {
          devDependencies: { auth: '^1.6.26' }
        }
      ),
    /exact semantic version/
  )
})

test('normalizes acronym suffixes for physical columns', () => {
  assert.equal(toSnakeCase('credentialID'), 'credential_id')
  assert.equal(toSnakeCase('activeOrganizationId'), 'active_organization_id')
})

test('uses a controlled config loader without inheriting arbitrary Node options', () => {
  const environment = safeEnvironment({
    PATH: '/usr/bin',
    NODE_OPTIONS: '--inspect=0.0.0.0:9229'
  })

  assert.equal(environment.PATH, '/usr/bin')
  assert.match(environment.NODE_OPTIONS, /^--require=.*tsconfig-paths/)
  assert.doesNotMatch(environment.NODE_OPTIONS, /inspect/)
})
