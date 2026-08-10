/**
 * Generates a pruned lockfile from the package manifest emitted by webpack.
 *
 * NxAppWebpackPlugin already writes the deployable package.json to
 * dist/services/<service>. Reading that generated manifest avoids maintaining a
 * second, drift-prone dependency list under services/<service>.
 */
const { createProjectGraphAsync, detectPackageManager } = require('@nx/devkit')
const { createLockFile, getLockFileName } = require('@nx/js')
const { existsSync, readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const supportedServices = new Set(['engine', 'pulse', 'worker'])

function getServiceName(value) {
  if (!supportedServices.has(value)) {
    throw new Error(`Unsupported service "${value ?? ''}". Expected one of: ${[...supportedServices].join(', ')}`)
  }

  return value
}

async function createServiceLockfile(serviceName) {
  const service = getServiceName(serviceName)
  const distDir = join(__dirname, '..', 'dist', 'services', service)
  const packageJsonPath = join(distDir, 'package.json')

  if (!existsSync(packageJsonPath)) {
    throw new Error(`${packageJsonPath} does not exist. Run ${service}:build before packaging.`)
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  const projectGraph = await createProjectGraphAsync()
  const packageManager = detectPackageManager()
  const lockFile = createLockFile(packageJson, projectGraph, packageManager)
  const lockFileName = getLockFileName(packageManager)

  writeFileSync(join(distDir, lockFileName), lockFile, 'utf8')
  console.log(`[create-service-lockfile] Generated ${service}/${lockFileName}`)
}

if (require.main === module) {
  createServiceLockfile(process.argv[2]).catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = { createServiceLockfile }
