import { fileURLToPath } from 'node:url'

export function verifyRequiredChecks(results) {
  for (const id of ['select', 'security', 'main', 'database-contract']) {
    if (results[id]?.result !== 'success') throw new Error(`${id}: ${results[id]?.result ?? 'missing'}`)
  }
  const chosen = results.select.outputs
  const selected = {
    backend: 'backendEnabled',
    generator: 'generator',
    bootstrap: 'bootstrap',
    extension: 'extension',
    web: 'web',
    mobile: 'mobileAndroid',
    'desktop-checks': 'desktop'
  }
  for (const [job, flag] of Object.entries(selected)) {
    if (!['true', 'false'].includes(chosen?.[flag])) throw new Error(`Missing selection result: ${flag}`)
    const expected = chosen[flag] === 'true' ? 'success' : 'skipped'
    if (results[job]?.result !== expected)
      throw new Error(`${job}: expected ${expected}, got ${results[job]?.result ?? 'missing'}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyRequiredChecks(JSON.parse(process.env.RESULTS))
  console.log('Every selected suite passed; intentionally unselected suites were skipped.')
}
