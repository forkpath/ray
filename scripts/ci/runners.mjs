/**
 * CI runner selection for jobs that may use self-hosted machines.
 *
 * Each role defaults to a GitHub-hosted image. A repository variable holding a JSON
 * label array (for example `["self-hosted","macOS","ARM64","ray-ios"]`) moves that
 * role to a self-hosted runner. Unset or empty restores the hosted image.
 *
 * Self-hosted machines keep state between jobs, so only trusted events may use them:
 * pushes, manual and scheduled runs, and pull requests opened from this repository
 * by a human. Bot-authored runs (Dependabot) and fork pull requests always stay hosted.
 * Malformed variables fail the run instead of silently falling back.
 *
 * CLI: `node scripts/ci/runners.mjs` writes `runners=<json>` to GITHUB_OUTPUT.
 * Only Node built-ins are used, so callers do not need to install dependencies.
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const HOSTED_RUNNERS = {
  ios: 'macos-26',
  desktopMacArm64: 'macos-15',
  desktopMacX64: 'macos-15-intel',
  desktopWin: 'windows-2025'
}

// Every self-hosted runner carries `self-hosted` plus its OS and architecture labels.
// Requiring them prevents, for example, an x64 desktop build silently running under Rosetta.
const ROLES = {
  ios: { variable: 'RAY_RUNNER_IOS', os: 'macOS', arch: null },
  desktopMacArm64: { variable: 'RAY_RUNNER_DESKTOP_MAC_ARM64', os: 'macOS', arch: 'ARM64' },
  desktopMacX64: { variable: 'RAY_RUNNER_DESKTOP_MAC_X64', os: 'macOS', arch: 'X64' },
  desktopWin: { variable: 'RAY_RUNNER_DESKTOP_WIN', os: 'Windows', arch: 'X64' }
}

// Android depends on hosted-only setup (sudo, /dev/kvm, the preinstalled SDK path).
const UNSUPPORTED_VARIABLES = ['RAY_RUNNER_ANDROID']

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
  for (const required of ['self-hosted', os, arch].filter(Boolean)) {
    if (!lower.has(required.toLowerCase())) throw new Error(`${variable} must include the "${required}" label`)
  }
  return labels
}

/**
 * @param {Record<string, string | undefined>} variables repository variables by name
 * @param {{ eventName?: string, actor?: string, repository?: string, headRepository?: string }} context
 * @returns {{ trusted: boolean, runners: Record<keyof typeof HOSTED_RUNNERS, string | string[]> }}
 */
export function resolveRunners(variables, context) {
  for (const variable of UNSUPPORTED_VARIABLES) {
    if (variables[variable]?.trim()) throw new Error(`${variable} is not supported; Android runs on hosted Linux`)
  }

  const trusted = isTrustedForSelfHosted(context)
  const runners = {}
  for (const [role, requirement] of Object.entries(ROLES)) {
    const value = variables[requirement.variable]?.trim()
    // Validate even when the event is untrusted, so a bad variable is caught on every run.
    const labels = value ? parseLabels(requirement.variable, value, requirement) : null
    runners[role] = labels && trusted ? labels : HOSTED_RUNNERS[role]
  }
  return { trusted, runners }
}

export function readContext(env = process.env) {
  let event = {}
  try {
    if (env.GITHUB_EVENT_PATH) event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'))
  } catch {
    // An unreadable payload only matters for pull requests, which then stay hosted.
  }
  return {
    eventName: env.GITHUB_EVENT_NAME,
    actor: env.GITHUB_ACTOR,
    repository: env.GITHUB_REPOSITORY,
    headRepository: event.pull_request?.head?.repo?.full_name,
    pullRequestAuthor: event.pull_request?.user?.login
  }
}

export function readVariables(env = process.env) {
  return Object.fromEntries(
    [...Object.values(ROLES).map(role => role.variable), ...UNSUPPORTED_VARIABLES].map(name => [name, env[name]])
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { trusted, runners } = resolveRunners(readVariables(), readContext())
  appendFileSync(process.env.GITHUB_OUTPUT, `runners=${JSON.stringify(runners)}\n`)
  console.log(JSON.stringify({ trusted, runners }, null, 2))
}
