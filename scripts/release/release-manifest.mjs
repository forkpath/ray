import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const releaseServices = ['engine', 'migrator', 'pulse', 'web', 'worker']
const digestPattern = /^sha256:[0-9a-f]{64}$/i
const gitShaPattern = /^[0-9a-f]{40}$/i

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} is required`)
  return value
}

export function createImageRecord(input) {
  const service = requireString(input.service, 'service')
  const image = requireString(input.image, 'image')
  const digest = requireString(input.digest, 'digest')
  const gitSha = requireString(input.gitSha, 'gitSha')
  const ref = requireString(input.ref, 'ref')

  if (!releaseServices.includes(service)) throw new Error(`Unsupported release service: ${service}`)
  if (!/^ghcr\.io\/[a-z0-9._/-]+$/.test(image)) throw new Error(`Invalid GHCR image: ${image}`)
  if (!image.endsWith(`/ray-${service}`)) throw new Error(`Image does not match service ${service}`)
  if (!digestPattern.test(digest)) throw new Error(`Invalid OCI digest for ${service}`)
  if (!gitShaPattern.test(gitSha)) throw new Error('gitSha must be a full commit SHA')
  if (ref !== 'refs/heads/main' && !ref.startsWith('refs/tags/v')) {
    throw new Error(`Invalid release ref: ${ref}`)
  }

  return { schemaVersion: 1, service, image, digest: digest.toLowerCase(), gitSha: gitSha.toLowerCase(), ref }
}

export function assembleReleaseManifest(records) {
  if (!Array.isArray(records) || records.length !== releaseServices.length) {
    throw new Error(`Release manifest requires ${releaseServices.length} image records`)
  }
  const normalized = records.map(createImageRecord)
  const byService = new Map(normalized.map(record => [record.service, record]))
  if (byService.size !== releaseServices.length || releaseServices.some(service => !byService.has(service))) {
    throw new Error('Release manifest must contain every service exactly once')
  }
  if (new Set(normalized.map(record => record.gitSha)).size !== 1) {
    throw new Error('Release image records contain mixed Git SHAs')
  }
  if (new Set(normalized.map(record => record.ref)).size !== 1) {
    throw new Error('Release image records contain mixed Git refs')
  }

  const images = Object.fromEntries(
    releaseServices.map(service => {
      const record = byService.get(service)
      return [service, { image: record.image, digest: record.digest }]
    })
  )
  return { schemaVersion: 1, gitSha: normalized[0].gitSha, ref: normalized[0].ref, images }
}

function option(argv, name) {
  const prefix = `--${name}=`
  const argument = argv.find(value => value.startsWith(prefix))
  if (!argument) throw new Error(`--${name} is required`)
  return argument.slice(prefix.length)
}

async function record(argv) {
  const output = option(argv, 'output')
  const recordValue = createImageRecord({
    service: process.env.RELEASE_SERVICE,
    image: process.env.RELEASE_IMAGE,
    digest: process.env.RELEASE_DIGEST,
    gitSha: process.env.RELEASE_GIT_SHA,
    ref: process.env.RELEASE_REF
  })
  await writeFile(output, `${JSON.stringify(recordValue, null, 2)}\n`, { flag: 'wx' })
  console.log(`[release-manifest] wrote ${output}`)
}

async function assemble(argv) {
  const input = option(argv, 'input')
  const output = option(argv, 'output')
  const files = (await readdir(input)).filter(file => file.endsWith('.json')).sort()
  const records = await Promise.all(files.map(file => readFile(join(input, file), 'utf8').then(JSON.parse)))
  const manifest = assembleReleaseManifest(records)
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  console.log(`[release-manifest] wrote ${basename(output)}`)
}

async function main() {
  const [command, ...argv] = process.argv.slice(2)
  if (command === 'record') return record(argv)
  if (command === 'assemble') return assemble(argv)
  throw new Error('Expected record or assemble command')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`[release-manifest] failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
