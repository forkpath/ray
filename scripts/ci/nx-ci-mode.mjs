import { spawnSync } from 'node:child_process'

const SHA_PATTERN = /^[0-9a-f]{40}$/i

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

export function resolveNxCiMode({
  eventName,
  ref,
  isForkPr,
  setShasOutcome,
  cloudProbeOutcome,
  base,
  head,
  commitRangeValid
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
