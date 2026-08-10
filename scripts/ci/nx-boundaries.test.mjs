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

const publicSubpathAliases = {
  '@libs/analytics/desktop': ['libs/analytics/src/desktop.tsx'],
  '@libs/analytics/env': ['libs/analytics/src/env.ts'],
  '@libs/analytics/extension': ['libs/analytics/src/extension.tsx'],
  '@libs/analytics/mobile': ['libs/analytics/src/mobile.tsx'],
  '@libs/analytics/server': ['libs/analytics/src/server.ts'],
  '@libs/analytics/web': ['libs/analytics/src/web.tsx'],
  '@libs/api-client/utils': ['libs/api-client/src/utils.ts'],
  '@libs/billing/mobile': ['libs/billing-native/src/index.ts'],
  '@libs/billing/server': ['libs/billing-server/src/index.ts'],
  '@libs/billing/web': ['libs/billing-server/src/index.ts'],
  '@libs/common/hooks': ['libs/common/src/hooks/index.ts'],
  '@libs/common/utils': ['libs/common/src/utils/index.ts'],
  '@libs/email/server': ['libs/email/src/server.ts'],
  '@libs/monitoring/desktop': ['libs/monitoring/src/desktop.tsx'],
  '@libs/monitoring/env': ['libs/monitoring/src/env.ts'],
  '@libs/monitoring/extension': ['libs/monitoring/src/extension.tsx'],
  '@libs/monitoring/mobile': ['libs/monitoring/src/mobile.tsx'],
  '@libs/monitoring/server': ['libs/monitoring/src/server.ts'],
  '@libs/monitoring/web': ['libs/monitoring/src/web.tsx'],
  '@libs/srv-shared/rabbitmq': ['libs/server-rabbitmq/src/index.ts'],
  '@libs/ui-shared/common': ['libs/ui-web/src/compat/common.ts'],
  '@libs/ui-shared/mobile': ['libs/ui-native/src/index.ts'],
  '@libs/ui-shared/web': ['libs/ui-web/src/index.ts']
}

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
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue

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

const findTsconfigFiles = async directory => {
  const absoluteDirectory = join(workspaceRoot, directory)
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue

    const child = join(absoluteDirectory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await findTsconfigFiles(relative(workspaceRoot, child))))
      continue
    }

    if (/^tsconfig(?:\.[\w-]+)?\.json$/.test(entry.name)) {
      files.push(relative(workspaceRoot, child))
    }
  }

  return files
}

const readProjects = async () => {
  const projectFiles = (
    await Promise.all(['apps', 'libs', 'services'].map(directory => findProjectFiles(directory)))
  ).flat()
  projectFiles.push('docker/migrator/project.json')
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
    assert.equal(projects.length, 45)

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

  it('permits only explicit public subpath aliases', async () => {
    const tsconfigFiles = [
      'tsconfig.base.json',
      ...(await findTsconfigFiles('apps')),
      ...(await findTsconfigFiles('libs')),
      ...(await findTsconfigFiles('services'))
    ]

    for (const file of tsconfigFiles) {
      const config = await readJson(file)
      const paths = config.compilerOptions?.paths ?? {}
      const wildcardAliases = Object.keys(paths).filter(alias => alias.startsWith('@libs/') && alias.includes('*'))
      assert.deepEqual(wildcardAliases, [], file)
    }

    const rootPaths = (await readJson('tsconfig.base.json')).compilerOptions.paths
    for (const [alias, targets] of Object.entries(publicSubpathAliases)) {
      assert.deepEqual(rootPaths[alias], targets, alias)
    }

    const roots = ['apps', 'libs', 'services']
    const sourceFiles = (await Promise.all(roots.map(root => findSourceFiles(root)))).flat()
    const violations = []

    for (const file of sourceFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      const imports = source.match(/@libs\/[\w-]+\/[\w./-]+/g) ?? []

      for (const specifier of imports) {
        if (!(specifier in publicSubpathAliases)) {
          violations.push(`${file}: ${specifier}`)
        }
      }
    }

    assert.deepEqual(violations, [])
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

  it('keeps server configuration contracts framework neutral', async () => {
    const projects = await readProjects()
    const serverKernel = projects.find(project => project.name === 'server-kernel')

    assert.ok(serverKernel)
    assert.ok(serverKernel.tags.includes('type:contract'))
    assert.ok(serverKernel.tags.includes('runtime:universal'))
    assert.ok(serverKernel.tags.includes('domain:platform'))

    const kernelFiles = await findSourceFiles('libs/server-kernel/src')
    for (const file of kernelFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.doesNotMatch(source, /from ['"](?:node:|@nestjs|ioredis|mongoose|@golevelup)/, file)
      assert.equal(source.includes('process.env'), false, file)
      assert.equal(source.includes('@libs/srv-'), false, file)
    }
  })

  it('keeps event envelopes universal and Worker execution on the Node platform boundary', async () => {
    const projects = await readProjects()
    const eventContract = projects.find(project => project.name === 'event-contract')
    const workerKernel = projects.find(project => project.name === 'worker-kernel')

    assert.ok(eventContract)
    assert.ok(eventContract.tags.includes('type:contract'))
    assert.ok(eventContract.tags.includes('runtime:universal'))
    assert.ok(eventContract.tags.includes('domain:platform'))
    assert.ok(workerKernel)
    assert.ok(workerKernel.tags.includes('type:platform'))
    assert.ok(workerKernel.tags.includes('runtime:node'))
    assert.ok(workerKernel.tags.includes('domain:platform'))

    const contractFiles = await findSourceFiles('libs/event-contract/src')
    for (const file of contractFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.doesNotMatch(source, /from ['"](?:node:|@nestjs|ioredis|mongoose|@golevelup|@libs\/pg-dao)/, file)
      assert.equal(source.includes('process.env'), false, file)
    }

    const tsconfig = await readJson('tsconfig.base.json')
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/event-contract'], ['libs/event-contract/src/index.ts'])
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/worker-kernel'], ['libs/worker-kernel/src/index.ts'])
  })

  it('routes server configuration owners through server-kernel', async () => {
    const adapterFiles = [
      'libs/mongo-dao/src/mongo-dao.module.ts',
      'libs/server-nest/src/config/index.ts',
      'libs/srv-shared/src/cache/cache.module.ts',
      'libs/srv-shared/src/logger/logger.module.ts',
      'libs/server-rabbitmq/src/rabbitmq.module.ts',
      'libs/server-redis/src/redis.module.ts',
      'libs/srv-shared/src/storage/storage.module.ts'
    ]

    for (const file of adapterFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.equal(source.includes("from '@libs/server-kernel'"), true, file)
    }

    for (const file of ['services/engine/tsconfig.app.json', 'services/worker/tsconfig.app.json']) {
      const config = await readJson(file)
      assert.deepEqual(config.compilerOptions.paths['@libs/server-kernel'], ['libs/server-kernel/src/index.ts'], file)
    }
  })

  it('keeps Nest cross-cutting behavior on an explicit Node boundary', async () => {
    const projects = await readProjects()
    const serverNest = projects.find(project => project.name === 'server-nest')

    assert.ok(serverNest)
    assert.ok(serverNest.tags.includes('type:platform'))
    assert.ok(serverNest.tags.includes('runtime:node'))
    assert.ok(serverNest.tags.includes('domain:platform'))

    const nestFiles = await findSourceFiles('libs/server-nest/src')
    for (const file of nestFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.equal(source.includes('@libs/srv-shared'), false, file)
      assert.equal(source.includes('@libs/srv-core'), false, file)
    }

    const engineModule = await readFile(join(workspaceRoot, 'services/engine/src/app.module.ts'), 'utf8')
    assert.equal(engineModule.includes("from '@libs/server-nest'"), true)
    assert.equal(engineModule.includes("from '@libs/srv-core'"), false)

    const tsconfig = await readJson('tsconfig.base.json')
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/srv-core'], ['libs/server-nest/src/index.ts'])
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/server-nest'], ['libs/server-nest/src/index.ts'])

    const engineTsconfig = await readJson('services/engine/tsconfig.app.json')
    assert.deepEqual(engineTsconfig.compilerOptions.paths['@libs/srv-core'], ['libs/server-nest/src/index.ts'])
    assert.deepEqual(engineTsconfig.compilerOptions.paths['@libs/server-nest'], ['libs/server-nest/src/index.ts'])

    const i18nModule = await readFile(join(workspaceRoot, 'libs/server-nest/src/i18n/i18n.module.ts'), 'utf8')
    assert.equal(i18nModule.includes('libs/server-nest/src/i18n/i18n.types.ts'), true)

    const i18nBridge = await readFile(join(workspaceRoot, 'libs/srv-shared/src/i18n/i18n.module.ts'), 'utf8')
    assert.equal(i18nBridge.trim(), "export { I18nModule } from '@libs/server-nest'")
  })

  it('keeps Redis infrastructure on an explicit Node adapter boundary', async () => {
    const projects = await readProjects()
    const serverRedis = projects.find(project => project.name === 'server-redis')

    assert.ok(serverRedis)
    assert.ok(serverRedis.tags.includes('type:platform'))
    assert.ok(serverRedis.tags.includes('runtime:node'))
    assert.ok(serverRedis.tags.includes('domain:platform'))

    const redisFiles = await findSourceFiles('libs/server-redis/src')
    for (const file of redisFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.equal(source.includes('@libs/srv-shared'), false, file)
      assert.equal(source.includes('@libs/srv-core'), false, file)
      assert.equal(source.includes('@libs/server-nest'), false, file)
    }

    const engineModule = await readFile(join(workspaceRoot, 'services/engine/src/app.module.ts'), 'utf8')
    assert.equal(engineModule.includes("import { RedisModule } from '@libs/server-redis'"), true)

    const tsconfig = await readJson('tsconfig.base.json')
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/server-redis'], ['libs/server-redis/src/index.ts'])

    const engineTsconfig = await readJson('services/engine/tsconfig.app.json')
    assert.deepEqual(engineTsconfig.compilerOptions.paths['@libs/server-redis'], ['libs/server-redis/src/index.ts'])

    const redisModuleBridge = await readFile(join(workspaceRoot, 'libs/srv-shared/src/redis/redis.module.ts'), 'utf8')
    assert.equal(redisModuleBridge.trim(), "export { RedisModule } from '@libs/server-redis'")
  })

  it('keeps RabbitMQ infrastructure on an explicit Node adapter boundary', async () => {
    const projects = await readProjects()
    const serverRabbitmq = projects.find(project => project.name === 'server-rabbitmq')

    assert.ok(serverRabbitmq)
    assert.ok(serverRabbitmq.tags.includes('type:platform'))
    assert.ok(serverRabbitmq.tags.includes('runtime:node'))
    assert.ok(serverRabbitmq.tags.includes('domain:platform'))

    const rabbitmqFiles = await findSourceFiles('libs/server-rabbitmq/src')
    for (const file of rabbitmqFiles) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.equal(source.includes('@libs/srv-shared'), false, file)
      assert.equal(source.includes('@libs/srv-core'), false, file)
      assert.equal(source.includes('@libs/server-nest'), false, file)
      assert.equal(source.includes('@libs/server-redis'), false, file)
    }

    for (const file of ['services/engine/src/app.module.ts', 'services/worker/src/app/app.module.ts']) {
      const source = await readFile(join(workspaceRoot, file), 'utf8')
      assert.equal(source.includes("import { RabbitmqModule } from '@libs/server-rabbitmq'"), true, file)
    }

    const tsconfig = await readJson('tsconfig.base.json')
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/server-rabbitmq'], ['libs/server-rabbitmq/src/index.ts'])
    assert.deepEqual(tsconfig.compilerOptions.paths['@libs/srv-shared/rabbitmq'], ['libs/server-rabbitmq/src/index.ts'])

    for (const file of ['services/engine/tsconfig.app.json', 'services/worker/tsconfig.app.json']) {
      const config = await readJson(file)
      assert.deepEqual(
        config.compilerOptions.paths['@libs/server-rabbitmq'],
        ['libs/server-rabbitmq/src/index.ts'],
        file
      )
    }

    const moduleBridge = await readFile(join(workspaceRoot, 'libs/srv-shared/src/rabbitmq/rabbitmq.module.ts'), 'utf8')
    assert.equal(moduleBridge.trim(), "export { RabbitmqModule } from '@libs/server-rabbitmq'")
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
