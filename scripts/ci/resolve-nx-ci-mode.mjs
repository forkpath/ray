#!/usr/bin/env node
import { appendFile } from 'node:fs/promises'

import { hasCiControlPlaneChange, hasValidCommitRange, resolveNxCiMode } from './nx-ci-mode.mjs'

const base = process.env.NX_BASE_CANDIDATE ?? ''
const head = process.env.NX_HEAD_CANDIDATE ?? ''
const commitRangeValid = hasValidCommitRange(base, head)
const result = resolveNxCiMode({
  eventName: process.env.CI_EVENT_NAME ?? '',
  ref: process.env.CI_REF ?? '',
  isForkPr: process.env.CI_IS_FORK_PR === 'true',
  setShasOutcome: process.env.NX_SET_SHAS_OUTCOME ?? 'skipped',
  cloudProbeOutcome: process.env.NX_CLOUD_PROBE_OUTCOME ?? 'skipped',
  base,
  head,
  commitRangeValid,
  ciControlPlaneChanged: commitRangeValid && hasCiControlPlaneChange(base, head)
})

const outputs = [
  `mode=${result.mode}`,
  `base=${result.base}`,
  `head=${result.head}`,
  `disable-cloud=${String(result.disableCloud)}`,
  `reason=${result.reason}`
].join('\n')

if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `${outputs}\n`, 'utf8')
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    '### Nx CI execution mode',
    '',
    '| Mode | Reason | Nx Cloud | Base | Head |',
    '| --- | --- | --- | --- | --- |',
    `| ${result.mode} | ${result.reason} | ${result.disableCloud ? 'disabled' : 'enabled'} | ${result.base || 'n/a'} | ${result.head || 'n/a'} |`,
    ''
  ].join('\n')
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8')
}

console.log(JSON.stringify(result))
