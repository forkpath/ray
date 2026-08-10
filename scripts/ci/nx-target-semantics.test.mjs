import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

const typecheckProjects = [
  ['apps/web-e2e/project.json', 'tsc --noEmit -p tsconfig.json'],
  ['libs/api-core/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/auth/project.json', 'tsc --noEmit -p tsconfig.typecheck.json'],
  ['libs/email/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/i18n/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/mongo-dao/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/payload/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/pg-dao/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/srv-core/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/srv-shared/project.json', 'tsc --noEmit -p tsconfig.lib.json']
]

const bundlerProjects = [
  'apps/web-e2e/tsconfig.json',
  'libs/api-core/tsconfig.json',
  'libs/mongo-dao/tsconfig.json',
  'libs/payload/tsconfig.json',
  'libs/srv-core/tsconfig.json',
  'libs/srv-shared/tsconfig.json'
]

describe('Nx target semantics', () => {
  it('provides deterministic no-emit typecheck targets', async () => {
    for (const [path, command] of typecheckProjects) {
      const project = await readJson(path)
      const target = project.targets.typecheck

      assert.equal(target.executor, 'nx:run-commands', path)
      assert.equal(target.options.command, command, path)
    }
  })

  it('uses a module mode compatible with bundler resolution', async () => {
    for (const path of bundlerProjects) {
      const tsconfig = await readJson(path)
      assert.equal(tsconfig.compilerOptions.module, 'preserve', path)
    }
  })

  it('keeps Better Auth typechecking independent from declaration emit', async () => {
    const tsconfig = await readJson('libs/auth/tsconfig.typecheck.json')

    assert.equal(tsconfig.compilerOptions.declaration, false)
  })
})
