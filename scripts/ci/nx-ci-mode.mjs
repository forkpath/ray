import { spawnSync } from 'node:child_process'

const SHA_PATTERN = /^[0-9a-f]{40}$/i
const CI_CONTROL_PLANE_FILES = new Set([
  '.github/workflows/ci.yml',
  'eslint.config.mjs',
  'nx.json',
  'package.json',
  'pnpm-lock.yaml',
  'tsconfig.base.json'
])
const CI_CONTROL_PLANE_PREFIXES = ['.github/workflows/', 'docker/', 'scripts/ci/']

function isAffectedEvent(eventName, ref) {
  return eventName === 'pull_request' || (eventName === 'push' && ref === 'refs/heads/dev')
}

export function hasValidCommitRange(base, head, git = spawnSync) {
  if (!SHA_PATTERN.test(base) || !SHA_PATTERN.test(head)) {
    return false
  }

  const commitExists = sha =>
    git('git', ['cat-file', '-e', `${sha}^{commit}`], {
      encoding: 'utf8',
      stdio: 'pipe'
    }).status === 0

  if (!commitExists(base) || !commitExists(head)) {
    return false
  }

  return (
    git('git', ['merge-base', '--is-ancestor', base, head], {
      encoding: 'utf8',
      stdio: 'pipe'
    }).status === 0
  )
}

export function hasCiControlPlaneChange(base, head, git = spawnSync) {
  if (!SHA_PATTERN.test(base) || !SHA_PATTERN.test(head)) {
    return false
  }

  const result = git('git', ['diff', '--name-only', '--diff-filter=ACMR', base, head], {
    encoding: 'utf8',
    stdio: 'pipe'
  })
  if (result.status !== 0) {
    return true
  }

  return result.stdout
    .split('\n')
    .filter(Boolean)
    .some(file => CI_CONTROL_PLANE_FILES.has(file) || CI_CONTROL_PLANE_PREFIXES.some(prefix => file.startsWith(prefix)))
}

export function resolveNxCiMode({
  eventName,
  ref,
  isForkPr,
  setShasOutcome,
  cloudProbeOutcome,
  base,
  head,
  commitRangeValid,
  ciControlPlaneChanged
}) {
  const forkPr = eventName === 'pull_request' && isForkPr

  if (!isAffectedEvent(eventName, ref)) {
    const cloudAvailable = cloudProbeOutcome === 'success'
    return {
      mode: 'full',
      base: '',
      head: '',
      disableCloud: !cloudAvailable,
      reason: cloudAvailable ? 'full-event' : 'full-event-cloud-unavailable'
    }
  }

  if (setShasOutcome !== 'success' || !commitRangeValid) {
    return {
      mode: 'full',
      base: '',
      head: '',
      disableCloud: forkPr || cloudProbeOutcome !== 'success',
      reason: setShasOutcome === 'success' ? 'invalid-sha-range' : 'sha-resolution-failed'
    }
  }

  if (ciControlPlaneChanged) {
    return {
      mode: 'full',
      base: '',
      head: '',
      disableCloud: forkPr || cloudProbeOutcome !== 'success',
      reason: 'ci-control-plane-change'
    }
  }

  if (!forkPr && cloudProbeOutcome !== 'success') {
    return {
      mode: 'full',
      base: '',
      head: '',
      disableCloud: true,
      reason: 'nx-cloud-unavailable'
    }
  }

  return {
    mode: 'affected',
    base,
    head,
    disableCloud: forkPr,
    reason: forkPr ? 'fork-pr-no-cloud' : 'affected-ready'
  }
}
