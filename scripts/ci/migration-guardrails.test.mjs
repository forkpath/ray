import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

describe('migration safety guardrails', () => {
  it('pins the Prisma CLI used by database workflows', async () => {
    const packageJson = await readJson('package.json')

    assert.equal(packageJson.devDependencies.prisma, '7.8.0')
  })

  it('keeps Prisma client generation independent from auth schema writes', async () => {
    const project = await readJson('libs/pg-dao/project.json')
    const dependencies = project.targets.generate.dependsOn ?? []

    assert.equal(
      dependencies.some(dependency => dependency?.projects === 'auth' && dependency?.target === 'generate-auth-schema'),
      false
    )
  })

  it('keeps database and online migrations outside Nx Cache', async () => {
    const project = await readJson('libs/pg-dao/project.json')
    const nxConfiguration = await readJson('nx.json')

    for (const target of ['migrate', 'deploy', 'reset', 'push']) {
      assert.equal(nxConfiguration.targetDefaults[target].cache, false)
    }
    assert.equal(project.targets['online-migrate'].cache, false)
    assert.equal(project.targets['online-migrate'].options.command, 'node ./scripts/run-online-migrations.mjs')
  })

  it('does not execute an unpinned Better Auth CLI', async () => {
    const project = await readJson('libs/auth/project.json')
    const target = project.targets['generate-auth-schema']

    assert.equal(target.cache, false)
    assert.equal(target.options.command, 'node scripts/schema-generation-frozen.mjs')
    assert.doesNotMatch(JSON.stringify(target), /pnpx|@latest/)
  })

  it('pins and aligns the governed Better Auth schema toolchain', async () => {
    const packageJson = await readJson('package.json')
    const toolingPackageJson = await readJson('tools/auth-schema-tooling/package.json')
    const project = await readJson('libs/auth/project.json')
    const versions = [
      packageJson.dependencies['better-auth'],
      packageJson.dependencies['@better-auth/expo'],
      packageJson.dependencies['@better-auth/passkey'],
      toolingPackageJson.devDependencies.auth
    ]

    assert.deepEqual(versions, ['1.6.26', '1.6.26', '1.6.26', '1.6.26'])
    assert.equal(toolingPackageJson.devDependencies['@mrleebo/prisma-ast'], '0.13.1')
    assert.equal(project.targets['schema-check'].cache, true)
    assert.equal(project.targets['schema-update'].cache, false)
    assert.equal(project.targets['schema-check'].options.command, 'node scripts/schema-contract.mjs check')
    assert.equal(project.targets['schema-update'].options.command, 'node scripts/schema-contract.mjs update')
    assert.doesNotMatch(JSON.stringify({ toolingPackageJson, targets: project.targets }), /\bnpx\b|\bpnpx\b|@latest/)
  })

  it('keeps Better Auth contracts and integration behavior under the standard test gate', async () => {
    const facadeProject = await readJson('libs/auth/project.json')
    const serverProject = await readJson('libs/auth-server/project.json')

    assert.equal(facadeProject.targets.test.executor, 'nx:noop')
    assert.deepEqual(facadeProject.targets.test.dependsOn, ['contract-test', 'integration-test'])
    assert.equal(facadeProject.targets['contract-test'].options.command, 'node --test scripts/schema-contract.test.mjs')
    assert.deepEqual(facadeProject.targets['integration-test'].dependsOn, [
      { projects: 'auth-server', target: 'integration-test' }
    ])
    assert.equal(serverProject.targets.test.executor, 'nx:noop')
    assert.deepEqual(serverProject.targets.test.dependsOn, ['integration-test'])
    assert.equal(serverProject.targets['integration-test'].options.command, 'vitest --config vitest.config.mts --run')
  })

  it('fails closed when the legacy schema generation target is invoked', () => {
    const result = spawnSync('node', ['scripts/schema-generation-frozen.mjs'], {
      cwd: 'libs/auth',
      encoding: 'utf8'
    })

    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Automatic Better Auth schema generation is disabled/)
  })

  it('uses the correctly spelled PostgreSQL URL in managed configuration', async () => {
    const envExample = await readFile('.env.example', 'utf8')
    const runtimeExample = await readFile('docs/deployment/examples/runtime.env.example', 'utf8')
    const applicationCompose = await readFile('docker/compose.application.yml', 'utf8')
    const prismaConfig = await readFile('libs/pg-dao/prisma.config.ts', 'utf8')

    assert.match(envExample, /^POSTGRES_DATABASE_URL=/m)
    assert.doesNotMatch(envExample, /^POSGTRES_DATABASE_URL=/m)
    assert.match(runtimeExample, /^POSTGRES_DATABASE_URL=/m)
    assert.match(applicationCompose, /RAY_RUNTIME_ENV_FILE/)
    assert.doesNotMatch(runtimeExample, /^POSGTRES_DATABASE_URL=/m)
    assert.doesNotMatch(applicationCompose, /POSGTRES_DATABASE_URL/)
    assert.match(prismaConfig, /resolvePostgresDatabaseUrl\(process\.env\)/)
  })
})
