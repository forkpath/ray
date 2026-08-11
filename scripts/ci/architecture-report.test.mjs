import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const reportUrl = new URL('../../docs/architecture/ray-saas-system-atlas.html', import.meta.url)
const report = await readFile(reportUrl, 'utf8')

test('architecture atlas remains a standalone accessible document', () => {
  assert.match(report, /^<!doctype html>/i)
  assert.match(report, /<html lang="zh-CN">/)
  assert.match(report, /<meta name="viewport"/)
  assert.match(report, /class="skip-link"/)
  assert.match(report, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(report, /<script[^>]+src=/i)
  assert.doesNotMatch(report, /<link[^>]+rel=["']stylesheet["']/i)
})

test('architecture atlas covers the governed project and database inventories', () => {
  const projectsBlock = report.match(/const projects = \[(?<body>[\s\S]*?)\n\s*const tables = \[/)?.groups?.body
  const tablesBlock = report.match(/const tables = \[(?<body>[\s\S]*?)\n\s*const filterState = /)?.groups?.body

  assert.ok(projectsBlock, 'project inventory data is missing')
  assert.ok(tablesBlock, 'database inventory data is missing')
  assert.equal(projectsBlock.match(/\bname:/g)?.length, 45)
  assert.equal(tablesBlock.match(/\bname:/g)?.length, 18)

  for (const section of ['overview', 'runtime', 'projects', 'database', 'nx', 'migration', 'findings', 'evidence']) {
    assert.match(report, new RegExp(`id="${section}"`))
  }
})

test('architecture atlas records the current audited evidence and open gates', () => {
  for (const evidence of [
    'Better Auth 1.6.26',
    '124/124 remote cache',
    'c88eb5182decfc2e4183ee55ecac82380a5af7b3',
    'nx-set-shas v5.0.1',
    '尚未部署',
    'Contract'
  ]) {
    assert.ok(report.includes(evidence), `missing evidence: ${evidence}`)
  }
})
