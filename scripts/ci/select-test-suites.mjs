import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import { parse } from 'yaml'

export function onlyDeploymentJobsChanged(before, after) {
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  const withoutDeployment = source => {
    const workflow = parse(source, { merge: true })
    if (!record(workflow) || !record(workflow.jobs)) throw new Error('Invalid workflow')
    const jobs = { ...workflow.jobs }
    for (const name of ['mobile', 'deploy-staging', 'staging-deployment']) {
      if (!record(jobs[name])) throw new Error(`Missing job: ${name}`)
    }
    delete jobs['deploy-staging']
    delete jobs['staging-deployment']
    return { ...workflow, jobs }
  }
  try {
    return isDeepStrictEqual(withoutDeployment(before), withoutDeployment(after))
  } catch {
    // Unknown or malformed workflows keep the conservative native matrix.
    return false
  }
}

export function selectTestSuites({ affected, nativeAffected = affected, files, full, ciDeploymentOnly = false }) {
  const harnessFiles = files.filter(file =>
    /^(scripts\/(testing|ci|release)\/|docker\/|patches\/|\.github\/(workflows|actions)\/|\.dockerignore$)/.test(file)
  )
  const all = full || harnessFiles.length > 0
  const has = project => all || affected.includes(project)
  // Release-only changes still run the full quality/container matrix. Device
  // binaries are unaffected by these files; the selector itself is verified by
  // the always-on CI contract tests. Unknown/shared harness changes stay full.
  const nativeHarnessChanged = harnessFiles.some(
    file =>
      !/^(scripts\/release\/|docker\/|\.dockerignore$|\.github\/workflows\/deploy\.yml$)/.test(file) &&
      ![
        'scripts/ci/select-test-suites.mjs',
        'scripts/ci/select-test-suites.test.mjs',
        'scripts/ci/promotion.test.mjs',
        'scripts/ci/framework-smoke.test.mjs'
      ].includes(file) &&
      !(ciDeploymentOnly && file === '.github/workflows/ci.yml')
  )
  const nativeAll = full || nativeHarnessChanged
  const nativeChanged = files.some(file =>
    /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|apps\/mobile\/(package\.json|app\.config\.|eas\.json|metro\.config\.|plugins\/))/.test(
      file
    )
  )
  const mobileAndroid = nativeAll || nativeChanged || nativeAffected.includes('mobile')
  return {
    full: all,
    backend: ['engine', 'pulse', 'worker'].filter(has),
    extension: has('extension'),
    desktop: has('desktop'),
    web: has('web') || has('web-e2e'),
    generator: has('ray-plugin') || files.includes('ray.resources.json'),
    // Fresh-checkout setup: only environment-level inputs, not ordinary app code.
    bootstrap:
      all ||
      files.some(file =>
        /^(scripts\/development\/|\.env\.example$|package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|nx\.json$|libs\/pg-dao\/(prisma\.config\.|src\/(migrations|seed)))/.test(
          file
        )
      ),
    mobileAndroid,
    mobileIos: mobileAndroid && (nativeAll || nativeChanged)
  }
}

export function requiresFullRun({ force, eventName, ref, base }) {
  return (
    force === 'true' ||
    ['schedule', 'workflow_dispatch', 'workflow_call'].includes(eventName) ||
    Boolean(ref?.startsWith('refs/tags/')) ||
    !base ||
    /^0+$/.test(base)
  )
}

function main() {
  const require = createRequire(import.meta.url)
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const base = event.pull_request?.base.sha ?? event.before
  let full = requiresFullRun({
    force: process.env.CI_FULL,
    eventName: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    base
  })
  let affected = []
  let nativeAffected = []
  let ciDeploymentOnly = false
  let files = []
  const affectedProjects = flags =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [require.resolve('nx/bin/nx'), 'show', 'projects', '--affected', ...flags, '--json'],
        {
          encoding: 'utf8',
          env: { ...process.env, NX_DAEMON: 'false' },
          maxBuffer: 16 * 1024 * 1024
        }
      )
    )
  if (!full) {
    try {
      execFileSync('git', ['cat-file', '-e', `${base}^{commit}`], { stdio: 'pipe' })
    } catch {
      full = true
    }
  }
  if (!full) {
    files = execFileSync('git', ['diff', '--name-only', '-z', base, head], { encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
    // Graph/config failures fail the selection job rather than omitting suites.
    affected = affectedProjects([`--base=${base}`, `--head=${head}`])
    nativeAffected = affected
    const ciPath = '.github/workflows/ci.yml'
    if (files.includes(ciPath)) {
      try {
        ciDeploymentOnly = onlyDeploymentJobsChanged(
          execFileSync('git', ['show', `${base}:${ciPath}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
          execFileSync('git', ['show', `${head}:${ciPath}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
        )
      } catch {
        ciDeploymentOnly = false
      }
      if (ciDeploymentOnly) {
        // ci.yml is an Nx sharedGlobal. Remove it only from native selection
        // after proving every shared setting and non-deployment job unchanged.
        const nativeFiles = files.filter(file => file !== ciPath)
        nativeAffected = nativeFiles.length ? affectedProjects([`--files=${nativeFiles.join(',')}`]) : []
      }
    }
  }
  const suites = selectTestSuites({ affected, nativeAffected, files, full, ciDeploymentOnly })
  const output = {
    full: suites.full,
    base: suites.full ? '' : base,
    head,
    backend: JSON.stringify({ project: suites.backend }),
    backendEnabled: suites.backend.length > 0,
    extension: suites.extension,
    desktop: suites.desktop,
    web: suites.web,
    generator: suites.generator,
    bootstrap: suites.bootstrap,
    mobileAndroid: suites.mobileAndroid,
    mobileIos: suites.mobileIos,
    mobile: JSON.stringify({
      include: [
        ...(suites.mobileAndroid ? [{ platform: 'android', os: 'ubuntu-24.04' }] : []),
        ...(suites.mobileIos ? [{ platform: 'ios', os: 'macos-26' }] : [])
      ]
    })
  }
  for (const [key, value] of Object.entries(output)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
  console.log(JSON.stringify({ ...output, affected, nativeAffected, ciDeploymentOnly }, null, 2))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
