#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

function fail(message) {
  console.error(`[nx-metrics:error] ${message}`)
  process.exit(2)
}

const separator = process.argv.indexOf('--')
const phaseArgument = process.argv.find(argument => argument.startsWith('--phase='))
const phase = phaseArgument?.slice('--phase='.length)

if (!phase || separator < 0 || separator === process.argv.length - 1) {
  fail('usage: run-nx-with-metrics.mjs --phase=<name> -- <command> [args...]')
}

const [command, ...commandArguments] = process.argv.slice(separator + 1)
const workspaceRoot = process.cwd()
const nxCacheDirectory = resolve(workspaceRoot, process.env.NX_CACHE_DIRECTORY || '.nx/cache')
const nxRunPath = resolve(nxCacheDirectory, 'run.json')
const metricsDirectory = resolve(workspaceRoot, process.env.CI_METRICS_DIR || 'artifacts/ci-metrics')
const startedAt = new Date()

await rm(nxRunPath, { force: true })

const child = spawn(command, commandArguments, {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    NX_CACHE_DIRECTORY: nxCacheDirectory
  },
  stdio: 'inherit'
})

const exitCode = await new Promise((resolveExit, reject) => {
  child.once('error', reject)
  child.once('exit', code => resolveExit(code ?? 1))
}).catch(error => {
  console.error(error)
  return 1
})
const finishedAt = new Date()

let nxRun
let captureError
try {
  nxRun = JSON.parse(await readFile(nxRunPath, 'utf8'))
} catch (error) {
  captureError = error instanceof Error ? error.message : String(error)
  nxRun = { run: {}, tasks: [] }
}

const deterministicTargets = new Set(['lint', 'typecheck', 'test', 'build'])
const tasks = (nxRun.tasks ?? []).map(task => ({
  id: task.taskId,
  project: task.projectName,
  target: task.target,
  hash: task.hash,
  status: task.status,
  cacheStatus: task.cacheStatus,
  durationMs: new Date(task.endTime).getTime() - new Date(task.startTime).getTime()
}))
const eligibleTasks = tasks.filter(task => deterministicTargets.has(task.target))
const cacheHits = eligibleTasks.filter(task => task.cacheStatus?.endsWith('cache-hit'))
const remoteCacheHits = eligibleTasks.filter(task => task.cacheStatus === 'remote-cache-hit')
const successfulTasks = tasks.filter(task => task.status === 0)
const ratio = (numerator, denominator) => (denominator === 0 ? null : Number((numerator / denominator).toFixed(4)))

const github = {
  actor: process.env.GITHUB_ACTOR ?? null,
  eventName: process.env.GITHUB_EVENT_NAME ?? null,
  job: process.env.GITHUB_JOB ?? null,
  ref: process.env.GITHUB_REF ?? null,
  repository: process.env.GITHUB_REPOSITORY ?? null,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  sha: process.env.GITHUB_SHA ?? null,
  workflow: process.env.GITHUB_WORKFLOW ?? null
}
const report = {
  schemaVersion: 1,
  phase,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationMs: finishedAt.getTime() - startedAt.getTime(),
  exitCode,
  invocation: {
    executable: basename(command)
  },
  nx: {
    startedAt: nxRun.run?.startTime ?? null,
    finishedAt: nxRun.run?.endTime ?? null,
    cloudConfigured: Boolean(process.env.NX_CLOUD_ACCESS_TOKEN),
    cloudDisabled: process.env.NX_NO_CLOUD === 'true'
  },
  execution: {
    sampleId: process.env.CI_METRICS_SAMPLE_ID ?? null,
    runnerLabel: process.env.CI_METRICS_RUNNER_LABEL ?? null,
    runnerOs: process.env.RUNNER_OS ?? null,
    runnerArch: process.env.RUNNER_ARCH ?? null
  },
  github,
  summary: {
    totalTasks: tasks.length,
    successfulTasks: successfulTasks.length,
    failedTasks: tasks.length - successfulTasks.length,
    deterministicTasks: eligibleTasks.length,
    cacheHits: cacheHits.length,
    remoteCacheHits: remoteCacheHits.length,
    cacheHitRate: ratio(cacheHits.length, eligibleTasks.length),
    remoteCacheHitRate: ratio(remoteCacheHits.length, eligibleTasks.length)
  },
  tasks,
  ...(captureError ? { captureError } : {})
}

await mkdir(metricsDirectory, { recursive: true })
const runIdentity = github.runId
  ? `${github.runId}-${github.runAttempt ?? '1'}`
  : `local-${startedAt.toISOString().replaceAll(/[:.]/g, '-')}`
const safePhase = basename(phase).replaceAll(/[^a-zA-Z0-9_-]/g, '-')
const reportPath = resolve(metricsDirectory, `${runIdentity}-${safePhase}.json`)
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

if (process.env.GITHUB_STEP_SUMMARY) {
  const percent = value => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`)
  const summary = [
    `### Nx CI metrics: ${phase}`,
    '',
    '| Duration | Tasks | Cache hit | Remote cache hit | Exit |',
    '| ---: | ---: | ---: | ---: | ---: |',
    `| ${(report.durationMs / 1000).toFixed(1)}s | ${tasks.length} | ${percent(report.summary.cacheHitRate)} | ${percent(report.summary.remoteCacheHitRate)} | ${exitCode} |`,
    '',
    `Artifact source: \`${reportPath}\``,
    ''
  ].join('\n')
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, 'utf8')
}

console.log(`[nx-metrics] wrote ${reportPath}`)
process.exit(exitCode)
