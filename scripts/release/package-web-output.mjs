import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function packageWebOutput(workspaceRoot = process.cwd()) {
  const source = resolve(workspaceRoot, 'apps/web/.output')
  const destination = resolve(workspaceRoot, 'dist/apps/web')
  const sourceStats = await stat(source).catch(() => null)
  if (!sourceStats?.isDirectory()) throw new Error(`Web build output is missing: ${source}`)

  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  await cp(source, destination, { recursive: true })
  return destination
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  packageWebOutput()
    .then(destination => console.log(`[web-package] staged ${destination}`))
    .catch(error => {
      console.error(`[web-package] failed: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    })
}
