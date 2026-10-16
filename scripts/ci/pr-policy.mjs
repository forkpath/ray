/**
 * Pull request branch policy, reported as the status check "PR policy".
 *
 * - Pull requests may only target dev or arch.
 * - main never takes pull requests: it is fast-forwarded to a dev commit that was
 *   deployed to staging, so production runs the exact commit staging verified.
 *
 * GitHub cannot stop anyone from opening a pull request against another branch, so this
 * check makes such pull requests visibly fail; the dev and arch rulesets require it.
 * See docs/development/branch-workflow.md.
 *
 * Usage (GitHub Actions, pull_request event): node scripts/ci/pr-policy.mjs
 */
import { appendFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const PULL_REQUEST_BASES = ['dev', 'arch']

export function checkBranches({ base }) {
  if (base === 'main') {
    return [
      'main does not accept pull requests. Release by fast-forwarding main to a staging-verified dev commit (branch-workflow.md, section 7.4).'
    ]
  }
  if (!PULL_REQUEST_BASES.includes(base)) {
    return [`Pull requests must target ${PULL_REQUEST_BASES.join(' or ')}; this one targets "${base}".`]
  }
  return []
}

function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const pullRequest = event.pull_request
  if (!pullRequest) throw new Error('PR policy runs on pull_request events only')
  const errors = checkBranches({ base: pullRequest.base.ref })

  const summary =
    errors.length === 0
      ? `PR policy passed: ${pullRequest.head.ref} -> ${pullRequest.base.ref}.`
      : `PR policy failed:\n\n${errors.map(error => `- ${error}`).join('\n')}`
  console.log(summary)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  if (errors.length > 0) process.exitCode = 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
