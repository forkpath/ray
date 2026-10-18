/**
 * Fails a self-hosted job early when its disk is nearly full.
 *
 * A self-hosted machine keeps caches between jobs, and a mobile run needs about 15 GB
 * of temporary space (native build tree, emulator data). Running out halfway produces
 * misleading build or emulator errors, so check up front instead.
 *
 * Usage: node scripts/ci/check-free-space.mjs [path]
 * The path defaults to the job workspace. RAY_MIN_FREE_GB sets the minimum (default 25).
 */
import { statfsSync } from 'node:fs'

const path = process.argv[2] || process.env.GITHUB_WORKSPACE || process.cwd()
const minimum = Number(process.env.RAY_MIN_FREE_GB || 25)
if (!Number.isFinite(minimum) || minimum < 0) throw new Error('RAY_MIN_FREE_GB must be a non-negative number')

const { bavail, bsize } = statfsSync(path)
const free = (bavail * bsize) / 1024 ** 3
console.log(`Free space at ${path}: ${free.toFixed(1)} GB (minimum ${minimum} GB)`)
if (free < minimum) {
  console.error(
    'Not enough free disk space on this runner; see "维护与磁盘清理" in docs/development/self-hosted-runners.md.'
  )
  process.exit(1)
}
