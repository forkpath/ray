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
    assert.equal(projects.length, 30)

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

  it('keeps Auth clients in their explicit frontend runtimes', async () => {
    const projects = await readProjects()
    const authWeb = projects.find(project => project.name === 'auth-web')
    const authNative = projects.find(project => project.name === 'auth-native')

    assert.ok(authWeb)
    assert.ok(authNative)
    assert.ok(authWeb.tags.includes('type:data-access'))
    assert.ok(authWeb.tags.includes('runtime:web'))
    assert.ok(authNative.tags.includes('type:data-access'))
    assert.ok(authNative.tags.includes('runtime:native'))
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
