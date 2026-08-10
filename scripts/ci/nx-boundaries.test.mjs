import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const workspaceRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))

const allowedTags = {
  type: ['app', 'feature', 'data-access', 'contract', 'ui', 'util', 'platform'],
  runtime: ['node', 'web', 'native', 'universal'],
  domain: ['auth', 'billing', 'organization', 'shared', 'platform', 'composition']
}

const facadeProjects = ['api-client', 'auth', 'billing', 'ui-shared']

const readJson = async path => JSON.parse(await readFile(join(workspaceRoot, path), 'utf8'))

const findProjectFiles = async directory => {
  const absoluteDirectory = join(workspaceRoot, directory)
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue

    const child = join(absoluteDirectory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findProjectFiles(relative(workspaceRoot, child))))
      continue
    }

    if (entry.name === 'project.json') {
      files.push(relative(workspaceRoot, child))
    }
  }

  return files
}

const findSourceFiles = async directory => {
  const absoluteDirectory = join(workspaceRoot, directory)
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const child = join(absoluteDirectory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findSourceFiles(relative(workspaceRoot, child))))
      continue
    }

    if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
      files.push(relative(workspaceRoot, child))
    }
  }

  return files
}

const readProjects = async () => {
  const projectFiles = (
    await Promise.all(['apps', 'libs', 'services'].map(directory => findProjectFiles(directory)))
  ).flat()
  const packageFiles = ['package.json', 'iam/package.json', 'tools/auth-schema-tooling/package.json']

  return Promise.all(
    [...projectFiles, ...packageFiles].map(async path => {
      const config = await readJson(path)
      return {
        name: config.name,
        path,
        tags: path.endsWith('project.json') ? config.tags : config.nx?.tags
      }
    })
  )
}

const readBoundaryConstraints = async () => {
  const eslintConfig = (await import('../../eslint.config.mjs')).default
  const moduleBoundaryConfig = eslintConfig.find(config => config.rules?.['@nx/enforce-module-boundaries'])
  assert.ok(moduleBoundaryConfig, 'Expected the Nx module-boundary rule')

  const [, options] = moduleBoundaryConfig.rules['@nx/enforce-module-boundaries']
  return options.depConstraints
}

describe('Nx boundary governance', () => {
  it('requires one type, runtime and domain tag on every project', async () => {
    const projects = await readProjects()
    assert.equal(projects.length, 39)

    for (const project of projects) {
      assert.ok(project.name, `Expected a project name in ${project.path}`)
      assert.ok(Array.isArray(project.tags), `Expected tags for ${project.name}`)

      for (const [dimension, values] of Object.entries(allowedTags)) {
        const dimensionTags = project.tags.filter(tag => tag.startsWith(`${dimension}:`))
        assert.equal(dimensionTags.length, 1, `${project.name} must have exactly one ${dimension} tag`)
        assert.ok(
          values.includes(dimensionTags[0].slice(dimension.length + 1)),
          `${project.name} has an unsupported ${dimension} tag`
        )
      }

      assert.equal(
        project.tags.some(tag => tag.startsWith('scope:') || tag.startsWith('platform:')),
        false
      )
      assert.equal(project.tags.includes('runtime:mixed'), false)
    }
  })

  it('keeps transitional facades explicit and finite', async () => {
    const projects = await readProjects()
    const actualFacades = projects
      .filter(project => project.tags.includes('boundary:facade'))
      .map(project => project.name)
      .sort()

    assert.deepEqual(actualFacades, facadeProjects)

    const apiClient = projects.find(project => project.name === 'api-client')
    assert.ok(apiClient)
    assert.ok(apiClient.tags.includes('domain:composition'))
    assert.equal(apiClient.tags.includes('domain:shared'), false)
  })

  it('exposes Auth cross-domain dependencies through the contract only', async () => {
    const projects = await readProjects()
    const authContract = projects.find(project => project.name === 'auth-contract')
    assert.ok(authContract)
    assert.ok(authContract.tags.includes('boundary:auth-contract'))

    const constraints = await readBoundaryConstraints()
    for (const domain of ['domain:billing', 'domain:organization']) {
      const constraint = constraints.find(candidate => candidate.sourceTag === domain)
      assert.ok(constraint)
      assert.ok(constraint.onlyDependOnLibsWithTags.includes('boundary:auth-contract'))
      assert.equal(constraint.onlyDependOnLibsWithTags.includes('domain:auth'), false)
    }
  })

  it('keeps Auth adapters in their explicit runtimes', async () => {
    const projects = await readProjects()
    const authWeb = projects.find(project => project.name === 'auth-web')
    const authNative = projects.find(project => project.name === 'auth-native')
    const authServer = projects.find(project => project.name === 'auth-server')

    assert.ok(authWeb)
    assert.ok(authNative)
    assert.ok(authServer)
    assert.ok(authWeb.tags.includes('type:data-access'))
    assert.ok(authWeb.tags.includes('runtime:web'))
    assert.ok(authNative.tags.includes('type:data-access'))
    assert.ok(authNative.tags.includes('runtime:native'))
    assert.ok(authServer.tags.includes('type:platform'))
    assert.ok(authServer.tags.includes('runtime:node'))
  })

  it('exposes Billing value contracts through a universal boundary', async () => {
    const projects = await readProjects()
    const billingContract = projects.find(project => project.name === 'billing-contract')
    const billingConfig = projects.find(project => project.name === 'billing-config')
    const billingClient = projects.find(project => project.name === 'billing-client')
    const billingNative = projects.find(project => project.name === 'billing-native')
    const billingServer = projects.find(project => project.name === 'billing-server')

    assert.ok(billingContract)
    assert.ok(billingContract.tags.includes('type:contract'))
    assert.ok(billingContract.tags.includes('runtime:universal'))
    assert.ok(billingContract.tags.includes('boundary:billing-contract'))

    assert.ok(billingConfig)
    assert.ok(billingConfig.tags.includes('type:util'))
    assert.ok(billingConfig.tags.includes('runtime:universal'))

    assert.ok(billingClient)
    assert.ok(billingClient.tags.includes('type:data-access'))
    assert.ok(billingClient.tags.includes('runtime:universal'))

    assert.ok(billingNative)
    assert.ok(billingNative.tags.includes('type:data-access'))
    assert.ok(billingNative.tags.includes('runtime:native'))

    assert.ok(billingServer)
    assert.ok(billingServer.tags.includes('type:platform'))
    assert.ok(billingServer.tags.includes('runtime:node'))
  })

  it('keeps shared UI primitives on a universal boundary', async () => {
    const projects = await readProjects()
    const uiCore = projects.find(project => project.name === 'ui-core')
    assert.ok(uiCore)
    assert.ok(uiCore.tags.includes('type:util'))
    assert.ok(uiCore.tags.includes('runtime:universal'))
    assert.ok(uiCore.tags.includes('domain:shared'))

    const coreFiles = await findSourceFiles('libs/ui-core/src')
    for (const file of coreFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.doesNotMatch(source, /from ['"](?:node:|react|react-native|@radix-ui|expo-)/, file)
      assert.doesNotMatch(source, /\b(?:window|document|navigator)\b/, file)
    }
  })

  it('keeps browser UI on an explicit Web boundary', async () => {
    const projects = await readProjects()
    const uiWeb = projects.find(project => project.name === 'ui-web')

    assert.ok(uiWeb)
    assert.ok(uiWeb.tags.includes('type:ui'))
    assert.ok(uiWeb.tags.includes('runtime:web'))
    assert.ok(uiWeb.tags.includes('domain:shared'))

    const webFiles = await findSourceFiles('libs/ui-web/src')
    for (const file of webFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.doesNotMatch(source, /from ['"](?:node:|react-native|expo-)/, file)
      assert.equal(source.includes('@libs/ui-shared/'), false, file)
    }
  })

  it('routes browser UI consumers through ui-web', async () => {
    const roots = ['apps', 'services', 'libs']
    const files = (await Promise.all(roots.map(root => findSourceFiles(root)))).flat()
    const violations = []

    for (const file of files) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      if (source.includes('@libs/ui-shared/web')) {
        violations.push(file)
      }
    }

    assert.deepEqual(violations, [])

    const tsconfig = await readJson('tsconfig.base.json')
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/ui-shared/web'], ['libs/ui-web/src/index.ts'])

    const facadeFiles = await findSourceFiles('libs/ui-shared/src')
    for (const file of facadeFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.equal(source.includes('@libs/ui-web'), false, file)
    }
  })

  it('keeps native UI on an explicit Native boundary', async () => {
    const projects = await readProjects()
    const uiNative = projects.find(project => project.name === 'ui-native')

    assert.ok(uiNative)
    assert.ok(uiNative.tags.includes('type:ui'))
    assert.ok(uiNative.tags.includes('runtime:native'))
    assert.ok(uiNative.tags.includes('domain:shared'))

    const nativeFiles = await findSourceFiles('libs/ui-native/src')
    for (const file of nativeFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.doesNotMatch(source, /from ['"](?:node:|react-dom|@radix-ui)/, file)
      assert.doesNotMatch(source, /\b(?:document|navigator)\b|globalThis\.window/, file)
      assert.equal(source.includes('@libs/ui-shared/'), false, file)
    }
  })

  it('routes native UI consumers through ui-native', async () => {
    const files = await findSourceFiles('apps/mobile/src')
    const violations = []

    for (const file of files) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      if (source.includes('@libs/ui-shared/mobile')) {
        violations.push(file)
      }
    }

    assert.deepEqual(violations, [])

    const tsconfig = await readJson('tsconfig.base.json')
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/ui-shared/mobile'], ['libs/ui-native/src/index.ts'])
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/ui-shared/mobile/*'], ['libs/ui-native/src/*'])

    const facadeFiles = await findSourceFiles('libs/ui-shared/src')
    for (const file of facadeFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.equal(source.includes('@libs/ui-native'), false, file)
    }
  })

  it('routes shared theme consumers through ui-core', async () => {
    const roots = ['apps', 'services', 'libs']
    const files = (await Promise.all(roots.map(root => findSourceFiles(root)))).flat()
    const violations = []

    for (const file of files) {
      if (file.startsWith('libs/ui-shared/src/common/')) continue
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      if (source.includes('@libs/ui-shared/common')) {
        violations.push(file)
      }
    }

    assert.deepEqual(violations, [])

    const tsconfig = await readJson('tsconfig.base.json')
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/ui-shared/common'], ['libs/ui-web/src/compat/common.ts'])
  })

  it('keeps Engine on the explicit Node Billing boundary', async () => {
    const engineFiles = await findSourceFiles('services/engine/src')
    const legacyImports = []

    for (const file of engineFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      if (/from ['"]@libs\/billing(?:\/server|\/web|['"])/.test(source)) {
        legacyImports.push(file)
      }
    }

    assert.deepEqual(legacyImports, [])
  })

  it('keeps legacy Node Billing paths as graph-safe compatibility aliases', async () => {
    const tsconfig = await readJson('tsconfig.base.json')
    const billingFiles = await findSourceFiles('libs/billing/src')

    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/billing/server'], ['libs/billing-server/src/index.ts'])
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/billing/web'], ['libs/billing-server/src/index.ts'])
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/billing/mobile'], ['libs/billing-native/src/index.ts'])

    for (const file of billingFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.equal(source.includes('@libs/billing-server'), false, file)
      assert.equal(source.includes('@libs/billing-native'), false, file)
    }
  })

  it('keeps browser and native runtimes off Billing server adapters', async () => {
    const roots = ['apps/web/src', 'apps/desktop/src', 'apps/mobile/src', 'apps/extension/src', 'libs/studio/src']
    const files = (await Promise.all(roots.map(root => findSourceFiles(root)))).flat()
    const violations = []

    for (const file of files) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      if (source.includes('@libs/billing-server')) {
        violations.push(file)
      }
    }

    assert.deepEqual(violations, [])
  })

  it('keeps native Billing consumers off the mixed facade', async () => {
    const files = await findSourceFiles('apps/mobile/src')
    const violations = []

    for (const file of files) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      if (source.includes("'@libs/billing/mobile'") || source.includes('"@libs/billing/mobile"')) {
        violations.push(file)
      }
    }

    assert.deepEqual(violations, [])
  })

  it('keeps transport-neutral Billing consumers off the Node facade', async () => {
    const roots = ['apps/web/src', 'apps/mobile/src', 'apps/extension/src', 'libs/api-client/src', 'libs/studio/src']
    const files = (await Promise.all(roots.map(root => findSourceFiles(root)))).flat()
    const violations = []

    for (const file of files) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      if (/from ['"]@libs\/billing['"]/.test(source)) {
        violations.push(file)
      }
    }

    assert.deepEqual(violations, [])
  })

  it('keeps runtime Billing consumers off the shared API facade', async () => {
    const roots = ['apps/web/src', 'apps/mobile/src', 'apps/extension/src', 'libs/studio/src']
    const files = (await Promise.all(roots.map(root => findSourceFiles(root)))).flat()
    const violations = []
    const legacyImport =
      /(?:import|export)\s*\{[^}]*\bbilling(?:Keys|Queries|Mutations)\b[^}]*\}\s*from ['"]@libs\/api-client['"]/s

    for (const file of files) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      if (legacyImport.test(source)) {
        violations.push(file)
      }
    }

    assert.deepEqual(violations, [])
  })

  it('keeps runtime consumers off the mixed Auth facade', async () => {
    const roots = ['apps/web/src', 'apps/desktop/src', 'apps/mobile/src', 'apps/extension/src', 'libs/studio/src']
    const files = (await Promise.all(roots.map(root => findSourceFiles(root)))).flat()

    for (const path of files) {
      const source = await readFile(join(workspaceRoot, path), 'utf8')
      assert.doesNotMatch(source, /from ['"]@libs\/auth(?:\/|['"])/, path)
    }
  })

  it('enforces every taxonomy value without wildcard constraints', async () => {
    const constraints = await readBoundaryConstraints()
    const sourceTags = constraints.map(constraint => constraint.sourceTag)

    assert.equal(JSON.stringify(constraints).includes('*'), false)

    for (const [dimension, values] of Object.entries(allowedTags)) {
      for (const value of values) {
        assert.equal(
          sourceTags.filter(tag => tag === `${dimension}:${value}`).length,
          1,
          `Expected one constraint for ${dimension}:${value}`
        )
      }
    }
  })

  it('prevents universal code from depending on runtime-specific projects', async () => {
    const constraints = await readBoundaryConstraints()
    const universal = constraints.find(constraint => constraint.sourceTag === 'runtime:universal')

    assert.deepEqual(universal.onlyDependOnLibsWithTags, ['runtime:universal', 'boundary:facade'])
  })

  it('prevents apps from depending on other apps', async () => {
    const constraints = await readBoundaryConstraints()
    const application = constraints.find(constraint => constraint.sourceTag === 'type:app')

    assert.equal(application.onlyDependOnLibsWithTags.includes('type:app'), false)
  })
})
