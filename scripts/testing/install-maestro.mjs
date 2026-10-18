import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const tools = JSON.parse(await readFile(resolve(import.meta.dirname, 'mobile-tools.json'), 'utf8'))
const root = resolve(import.meta.dirname, '../..')
// Self-hosted runners point this outside the checkout, which actions/checkout cleans every job.
const toolsDirectory = process.env.RAY_TESTING_TOOLS_DIR || resolve(root, '.cache/testing-tools')
const directory = resolve(toolsDirectory, `maestro-${tools.maestroVersion}`)
const binary = resolve(directory, 'maestro/bin/maestro')
// Written only after a verified extraction, so an interrupted install is never reused.
const marker = resolve(directory, 'installed.sha256')

const installed = await readFile(marker, 'utf8').catch(() => '')
if (
  installed.trim() === tools.maestroSha256 &&
  (await access(binary).then(
    () => true,
    () => false
  ))
) {
  console.log(`Verified Maestro ${tools.maestroVersion} already installed: ${binary}`)
  process.exit(0)
}

await rm(directory, { recursive: true, force: true })
await mkdir(directory, { recursive: true })
const archive = resolve(directory, 'maestro.zip')
const response = await fetch(
  `https://github.com/mobile-dev-inc/Maestro/releases/download/cli-${tools.maestroVersion}/maestro.zip`,
  {
    signal: AbortSignal.timeout(300_000)
  }
)
if (!response.ok || !response.body) throw new Error(`Maestro download failed: ${response.status}`)
await pipeline(Readable.fromWeb(response.body), createWriteStream(archive))
const hash = createHash('sha256')
for await (const chunk of createReadStream(archive)) hash.update(chunk)
if (hash.digest('hex') !== tools.maestroSha256) {
  await rm(archive)
  throw new Error('Maestro archive checksum does not match the pinned release')
}
// unzip preserves the executable bits used by Maestro's bundled drivers.
execFileSync('unzip', ['-q', '-o', archive, '-d', directory], { timeout: 120_000 })
await rm(archive)
await writeFile(marker, `${tools.maestroSha256}\n`)
console.log(`Installed verified Maestro ${tools.maestroVersion}: ${binary}`)
