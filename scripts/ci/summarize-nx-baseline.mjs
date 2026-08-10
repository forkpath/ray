#!/usr/bin/env node
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import { buildNxBaselineSummary } from './nx-baseline.mjs'

function readOption(name, fallback) {
  const prefix = `--${name}=`
  return process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length) ?? fallback
}

async function findJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(entry => {
      const entryPath = resolve(directory, entry.name)
      if (entry.isDirectory()) return findJsonFiles(entryPath)
      return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : []
    })
  )
  return nested.flat()
}

const metricsDirectory = resolve(readOption('metrics-dir', 'artifacts/ci-baseline-samples'))
const outputPath = resolve(readOption('output', 'artifacts/ci-baseline-summary/baseline.json'))
const expectedSamples = Number(readOption('expected-samples', '5'))

const files = await findJsonFiles(metricsDirectory)
const reports = await Promise.all(files.map(async file => JSON.parse(await readFile(file, 'utf8'))))
const summary = buildNxBaselineSummary(reports, { expectedSamples })

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    '### Candidate Nx Wave 0 baseline',
    '',
    `- Git SHA: \`${summary.gitSha}\``,
    `- Samples: ${summary.method.sampleCount} independent \`${summary.method.runner}\` jobs`,
    `- Median: ${summary.medianDurationMs} ms`,
    `- Candidate repository variable: \`${summary.repositoryVariable.name}=${summary.repositoryVariable.value}\``,
    '',
    'This remains a candidate until its artifact provenance is recorded in the migration ledger.',
    ''
  ]
  await appendFile(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'), 'utf8')
}

console.log(JSON.stringify(summary, null, 2))
