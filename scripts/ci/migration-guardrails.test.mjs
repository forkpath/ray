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

  it('does not execute an unpinned Better Auth CLI', async () => {
    const project = await readJson('libs/auth/project.json')
    const target = project.targets['generate-auth-schema']

    assert.equal(target.cache, false)
    assert.equal(target.options.command, 'node scripts/schema-generation-frozen.mjs')
    assert.doesNotMatch(JSON.stringify(target), /pnpx|@latest/)
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
    const compose = await readFile('docker/docker-compose.yml', 'utf8')
    const prismaConfig = await readFile('libs/pg-dao/prisma.config.ts', 'utf8')

    assert.match(envExample, /^POSTGRES_DATABASE_URL=/m)
    assert.doesNotMatch(envExample, /^POSGTRES_DATABASE_URL=/m)
    assert.match(compose, /POSTGRES_DATABASE_URL:/)
    assert.doesNotMatch(compose, /POSGTRES_DATABASE_URL:/)
    assert.match(prismaConfig, /resolvePostgresDatabaseUrl\(process\.env\)/)
  })
})
