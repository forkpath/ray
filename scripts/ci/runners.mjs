/**
 * CI runner selection for client test lanes that may use self-hosted machines.
 *
 * Each role defaults to a GitHub-hosted image. A repository variable holding a JSON
 * label array (for example `["self-hosted","macOS","X64","ray-mac"]`) moves that role
 * to a self-hosted runner. Unset or empty restores the hosted image. A role without a
 * hosted image (Apple-silicon desktop) runs only when its variable is set.
 *
 * Self-hosted machines keep state between jobs, so only trusted events may use them:
 * pushes, manual and scheduled runs, and pull requests opened from this repository
 * by a human. Bot-authored runs (Dependabot) and fork pull requests never do; their
 * self-hosted lanes fall back to the hosted image, except lanes whose hosted image is
 * macOS (billed at 10x Linux minutes), which are skipped by default. Set
 * RAY_RUNNER_UNTRUSTED=hosted to run those on hosted macOS as well.
 * Malformed variables fail the run instead of silently falling back.
 *
 * CLI: `node scripts/ci/runners.mjs` writes `runners`, `desktop` (a matrix) and
 * `desktopEnabled` to GITHUB_OUTPUT. Only Node built-ins are used, so callers do not
 * need to install dependencies.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Every self-hosted runner carries `self-hosted` plus its OS label (one of `os`) and,
// where it matters, its architecture. Requiring them prevents, for example, an x64
// desktop build silently running under Rosetta on an Apple-silicon Mac.
const ROLES = {
  ios: { variable: 'RAY_RUNNER_IOS', os: ['macOS'], arch: null, hosted: 'macos-26' },
  // The Android lane needs an emulator with hardware acceleration: KVM on Linux, HVF on macOS.
  android: { variable: 'RAY_RUNNER_ANDROID', os: ['Linux', 'macOS'], arch: null, hosted: 'ubuntu-24.04' },
  desktopMacX64: { variable: 'RAY_RUNNER_DESKTOP_MAC_X64', os: ['macOS'], arch: 'X64', hosted: 'macos-15-intel' },
  desktopWin: { variable: 'RAY_RUNNER_DESKTOP_WIN', os: ['Windows'], arch: 'X64', hosted: 'windows-2025' },
  // Opt-in: no hosted lane, so Apple-silicon desktop is tested only on a configured machine.
  desktopMacArm64: { variable: 'RAY_RUNNER_DESKTOP_MAC_ARM64', os: ['macOS'], arch: 'ARM64', hosted: null }
}

export const HOSTED_RUNNERS = Object.fromEntries(Object.entries(ROLES).map(([role, { hosted }]) => [role, hosted]))

const UNTRUSTED_VARIABLE = 'RAY_RUNNER_UNTRUSTED'
const UNTRUSTED_POLICIES = ['skip', 'hosted']

// `os` names the hosted image the lane mirrors and labels its artifacts.
const DESKTOP_LANES = [
  { role: 'desktopMacX64', os: 'macos-15-intel', arch: 'x64' },
  { role: 'desktopWin', os: 'windows-2025', arch: 'x64' },
  { role: 'desktopMacArm64', os: 'macos-15', arch: 'arm64' }
]

export function isTrustedForSelfHosted({ eventName, actor, repository, headRepository, pullRequestAuthor }) {
  if (!actor || actor.endsWith('[bot]')) return false
  // A human updating a bot's pull request becomes the actor; the code is still the bot's.
  if (pullRequestAuthor?.endsWith('[bot]')) return false
  if (eventName === 'pull_request') return Boolean(repository) && headRepository === repository
  return ['push', 'workflow_dispatch', 'schedule'].includes(eventName)
}

function parseLabels(variable, value, { os, arch }) {
  let labels
  try {
    labels = JSON.parse(value)
  } catch {
    throw new Error(`${variable} must be a JSON array of runner labels`)
  }
  if (!Array.isArray(labels) || labels.length === 0 || labels.some(label => typeof label !== 'string' || !label.trim()))
    throw new Error(`${variable} must be a non-empty JSON array of label strings`)

  // GitHub matches runner labels case-insensitively.
  const lower = new Set(labels.map(label => label.toLowerCase()))
  if (!lower.has('self-hosted')) throw new Error(`${variable} must include the "self-hosted" label`)
  if (!os.some(name => lower.has(name.toLowerCase())))
    throw new Error(`${variable} must include ${os.map(name => `the "${name}"`).join(' or ')} label`)
  if (arch && !lower.has(arch.toLowerCase())) throw new Error(`${variable} must include the "${arch}" label`)
  return labels
}

/**
 * @param {Record<string, string | undefined>} variables repository variables by name
 * @param {{ eventName?: string, actor?: string, repository?: string, headRepository?: string }} context
 * @returns {{
 *   trusted: boolean,
 *   runners: Record<keyof typeof ROLES, string | string[] | null>,
 *   skipped: { role: string, reason: string }[]
 * }} a `null` runner means the lane does not run
 */
export function resolveRunners(variables, context) {
  const policy = variables[UNTRUSTED_VARIABLE]?.trim() || 'skip'
  if (!UNTRUSTED_POLICIES.includes(policy))
    throw new Error(`${UNTRUSTED_VARIABLE} must be one of: ${UNTRUSTED_POLICIES.join(', ')}`)

  const trusted = isTrustedForSelfHosted(context)
  const runners = {}
  const skipped = []
  for (const [role, requirement] of Object.entries(ROLES)) {
    const value = variables[requirement.variable]?.trim()
    // Validate even when the event is untrusted, so a bad variable is caught on every run.
    const labels = value ? parseLabels(requirement.variable, value, requirement) : null
    const costly = !requirement.hosted || requirement.hosted.startsWith('macos-')
    if (!labels) runners[role] = requirement.hosted
    else if (trusted) runners[role] = labels
    else if (requirement.hosted && (policy === 'hosted' || !costly)) runners[role] = requirement.hosted
    else {
      runners[role] = null
      skipped.push({
        role,
        reason: `${requirement.variable} is self-hosted, this run is not trusted, and the hosted fallback is macOS`
      })
    }
  }
  return { trusted, runners, skipped }
}

/** The desktop matrix: one entry per lane that has a runner. */
export function desktopMatrix(runners) {
  return {
    include: DESKTOP_LANES.filter(({ role }) => runners[role]).map(({ role, os, arch }) => ({
      os,
      arch,
      runner: runners[role]
    }))
  }
}

/** Markdown for the job summary; empty when nothing was skipped. */
export function skippedSummary(skipped) {
  if (skipped.length === 0) return ''
  return [
    '## Client lanes skipped for an untrusted run',
    '',
    ...skipped.map(({ role, reason }) => `- ${role}: ${reason}`),
    '',
    'Bots and forks never run on self-hosted machines. To cover these lanes before merging, set',
    'RAY_RUNNER_UNTRUSTED=hosted (billed hosted macOS), or deliberately start the workflow manually',
    '(workflow_dispatch) on this branch, which runs the dependency changes on your own machine.',
    ''
  ].join('\n')
}

export function readContext(env = process.env) {
  let event = {}
  try {
    if (env.GITHUB_EVENT_PATH) event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))
  } catch {
    // An unreadable payload only matters for pull requests, which then stay off self-hosted machines.
  }
  return {
    eventName: env.GITHUB_EVENT_NAME,
    actor: env.GITHUB_ACTOR,
    repository: env.GITHUB_REPOSITORY,
    headRepository: event.pull_request?.head?.repo?.full_name,
    pullRequestAuthor: event.pull_request?.user?.login
  }
}

export const RUNNER_VARIABLES = [...Object.values(ROLES).map(role => role.variable), UNTRUSTED_VARIABLE]

export function readVariables(env = process.env) {
  return Object.fromEntries(RUNNER_VARIABLES.map(name => [name, env[name]]))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { trusted, runners, skipped } = resolveRunners(readVariables(), readContext())
  const desktop = desktopMatrix(runners)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `runners=${JSON.stringify(runners)}\ndesktop=${JSON.stringify(desktop)}\ndesktopEnabled=${desktop.include.length > 0}\n`
  )
  const summary = skippedSummary(skipped)
  if (summary && process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
  console.log(JSON.stringify({ trusted, runners, skipped, desktop }, null, 2))
}
