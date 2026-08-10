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
  ['libs/auth-contract/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/auth-native/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/auth-server/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/auth-web/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/billing-contract/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/billing-config/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/billing-client/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/billing-native/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/billing-server/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/email/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/i18n/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/mongo-dao/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/payload/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/pg-dao/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/srv-core/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/srv-shared/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/ui-core/project.json', 'tsc --noEmit -p tsconfig.lib.json'],
  ['libs/ui-web/project.json', 'tsc --noEmit -p tsconfig.lib.json']
]

const bundlerProjects = [
  'apps/web-e2e/tsconfig.json',
  'libs/api-core/tsconfig.json',
  'libs/mongo-dao/tsconfig.json',
  'libs/payload/tsconfig.json',
  'libs/srv-core/tsconfig.json',
  'libs/srv-shared/tsconfig.json'
]

const packagedServices = ['services/engine/project.json', 'services/pulse/project.json', 'services/worker/project.json']

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
    const facadeTsconfig = await readJson('libs/auth/tsconfig.typecheck.json')
    const serverTsconfig = await readJson('libs/auth-server/tsconfig.lib.json')

    assert.equal(facadeTsconfig.compilerOptions.declaration, false)
    assert.equal(serverTsconfig.compilerOptions.declaration, false)
  })

  it('registers IAM as a pnpm workspace with an Nx typecheck target', async () => {
    const workspace = await readFile('pnpm-workspace.yaml', 'utf8')
    const packageJson = await readJson('iam/package.json')

    assert.match(workspace, /^\s+- 'iam'$/m)
    assert.deepEqual(packageJson.nx.includedScripts, ['typecheck'])
  })

  it('uses package as the standard server deployment assembly target', async () => {
    for (const path of packagedServices) {
      const project = await readJson(path)
      const service = path.split('/')[1]

      assert.equal(project.targets.package.executor, 'nx:noop', path)
      assert.deepEqual(project.targets.package.dependsOn, ['prune-lockfile', 'copy-workspace-modules'], path)
      assert.equal(
        project.targets['prune-lockfile'].options.command,
        `node scripts/create-service-lockfile.js ${service}`,
        path
      )
      assert.equal(
        project.targets['copy-workspace-modules'].options.command,
        `node scripts/prepare-service-workspace-modules.js ${service}`,
        path
      )
      assert.ok(
        project.targets['prune-lockfile'].inputs.includes('{workspaceRoot}/scripts/create-service-lockfile.js'),
        path
      )
      assert.ok(
        project.targets['copy-workspace-modules'].inputs.includes(
          '{workspaceRoot}/scripts/prepare-service-workspace-modules.js'
        ),
        path
      )
      assert.deepEqual(project.targets.prune.dependsOn, ['package'], path)
    }

    const deployScript = await readFile('scripts/deploy.sh', 'utf8')
    assert.match(deployScript, /pnpm exec nx run engine:package/)
    assert.doesNotMatch(deployScript, /node scripts\/create-engine-lockfile\.js/)
  })
})
