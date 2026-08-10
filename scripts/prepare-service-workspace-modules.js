/**
 * Verifies that webpack bundled all local workspace libraries for a service.
 *
 * The generated deployable package.json must contain external packages only.
 * If a workspace package is ever externalized, fail closed so packaging cannot
 * silently publish an image with a missing local module.
 */
const { createProjectGraphAsync } = require('@nx/devkit')
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const supportedServices = new Set(['engine', 'pulse', 'worker'])

function getServiceName(value) {
  if (!supportedServices.has(value)) {
    throw new Error(`Unsupported service "${value ?? ''}". Expected one of: ${[...supportedServices].join(', ')}`)
  }

  return value
}

async function prepareServiceWorkspaceModules(serviceName) {
  const service = getServiceName(serviceName)
  const distDir = join(__dirname, '..', 'dist', 'services', service)
  const packageJsonPath = join(distDir, 'package.json')

  if (!existsSync(packageJsonPath)) {
    throw new Error(`${packageJsonPath} does not exist. Run ${service}:build before packaging.`)
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  const projectGraph = await createProjectGraphAsync()
  const workspacePackageNames = new Set(
    Object.values(projectGraph.nodes)
      .map(node => node.data.metadata?.js?.packageName)
      .filter(Boolean)
  )
  const dependencies = Object.entries(packageJson.dependencies ?? {})
  const unresolvedWorkspaceDependencies = dependencies.filter(
    ([name, version]) => workspacePackageNames.has(name) || /^(?:file|link|workspace):/.test(version)
  )

  if (unresolvedWorkspaceDependencies.length > 0) {
    throw new Error(
      `${service} externalized workspace dependencies: ${unresolvedWorkspaceDependencies
        .map(([name]) => name)
        .join(', ')}. Add an explicit copy strategy before packaging.`
    )
  }

  const workspaceModulesDir = join(distDir, 'workspace_modules')
  mkdirSync(workspaceModulesDir, { recursive: true })
  writeFileSync(
    join(workspaceModulesDir, '.bundled-workspace-modules.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        service,
        strategy: 'bundled-by-webpack',
        workspacePackages: []
      },
      null,
      2
    )}\n`,
    'utf8'
  )
  console.log(`[prepare-service-workspace-modules] ${service} has no externalized workspace packages`)
}

if (require.main === module) {
  prepareServiceWorkspaceModules(process.argv[2]).catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = { prepareServiceWorkspaceModules }
