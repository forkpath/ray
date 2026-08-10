import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import { packageWebOutput } from '../release/package-web-output.mjs'
import { assembleReleaseManifest, createImageRecord, releaseServices } from '../release/release-manifest.mjs'

const fullSha = 'a'.repeat(40)
const digest = value => `sha256:${value.repeat(64)}`
const imageRecord = (service, overrides = {}) => ({
  service,
  image: `ghcr.io/forkpath/ray-${service}`,
  digest: digest(service === 'engine' ? '1' : String(releaseServices.indexOf(service) + 2)),
  gitSha: fullSha,
  ref: 'refs/tags/v1.0.0',
  ...overrides
})

describe('release manifest', () => {
  it('requires one immutable digest for every release service', () => {
    const manifest = assembleReleaseManifest(releaseServices.map(service => imageRecord(service)))
    assert.equal(manifest.gitSha, fullSha)
    assert.deepEqual(Object.keys(manifest.images), releaseServices)
    assert.equal(manifest.images.migrator.image, 'ghcr.io/forkpath/ray-migrator')
  })

  it('rejects mixed SHAs, missing services, mutable or malformed image identities', () => {
    assert.throws(
      () =>
        assembleReleaseManifest(
          releaseServices.map(service => imageRecord(service, service === 'worker' ? { gitSha: 'b'.repeat(40) } : {}))
        ),
      /mixed Git SHAs/
    )
    assert.throws(() => assembleReleaseManifest(releaseServices.slice(1).map(imageRecord)), /requires 5/)
    assert.throws(() => createImageRecord(imageRecord('engine', { digest: 'latest' })), /Invalid OCI digest/)
    assert.throws(
      () => createImageRecord(imageRecord('engine', { image: 'docker.io/ray-engine' })),
      /Invalid GHCR image/
    )
    assert.throws(
      () => createImageRecord(imageRecord('engine', { image: 'ghcr.io/forkpath/ray-worker' })),
      /does not match service/
    )
    assert.throws(() => createImageRecord(imageRecord('engine', { ref: 'refs/heads/dev' })), /Invalid release ref/)
  })
})

describe('web release packaging', () => {
  it('copies the deterministic build output without deleting the source', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'ray-web-package-'))
    try {
      const source = join(workspace, 'apps/web/.output/server')
      await mkdir(source, { recursive: true })
      await writeFile(join(source, 'index.mjs'), 'export default true\n')
      const destination = await packageWebOutput(workspace)
      assert.equal(await readFile(join(destination, 'server/index.mjs'), 'utf8'), 'export default true\n')
      assert.equal(await readFile(join(source, 'index.mjs'), 'utf8'), 'export default true\n')
    } finally {
      await rm(workspace, { recursive: true, force: true })
    }
  })
})

describe('immutable image workflow guardrails', () => {
  it('publishes only after CI and retires the mutable SSH deploy workflow', async () => {
    const ci = await readFile('.github/workflows/ci.yml', 'utf8')
    const workflow = await readFile('.github/workflows/release-images.yml', 'utf8')
    const extensionWorkflow = await readFile('.github/workflows/release-extension.yml', 'utf8')
    assert.match(ci, /publish-images:[\s\S]+needs: main/)
    assert.match(ci, /uses: \.\/\.github\/workflows\/release-images\.yml/)
    assert.match(ci, /publish-extension:[\s\S]+needs: main/)
    assert.match(ci, /uses: \.\/\.github\/workflows\/release-extension\.yml/)
    assert.match(workflow, /workflow_call:/)
    assert.match(workflow, /Production tags must point to a commit on main/)
    assert.match(extensionWorkflow, /workflow_call:/)
    assert.match(extensionWorkflow, /Production tags must point to a commit on main/)

    assert.doesNotMatch(workflow, /(?:^|:)latest\b|\bnpx\b|\bpnpx\b|git pull/)
    assert.match(workflow, /\$\{image\}:\$\{GITHUB_SHA\}/)
    assert.match(workflow, /provenance: mode=max/)
    assert.match(workflow, /sbom: true/)
    assert.equal(await stat('.github/workflows/deploy.yml').catch(() => null), null)
  })

  it('pins every external GitHub Action to a full commit SHA', async () => {
    const files = (await readdir('.github/workflows')).filter(file => file.endsWith('.yml'))
    const workflows = await Promise.all(files.map(file => readFile(`.github/workflows/${file}`, 'utf8')))
    const actionReferences = workflows.flatMap(workflow =>
      [...workflow.matchAll(/uses:\s+([^\s#]+)/g)]
        .map(match => match[1])
        .filter(reference => !reference.startsWith('./'))
    )
    assert.ok(actionReferences.length > 0)
    assert.ok(actionReferences.every(reference => /@[0-9a-f]{40}$/.test(reference)))
  })

  it('pins the runtime and migrator toolchain and runs containers unprivileged', async () => {
    const dockerfiles = await Promise.all(
      ['engine', 'migrator', 'pulse', 'web', 'worker'].map(name => readFile(`docker/${name}.Dockerfile`, 'utf8'))
    )
    for (const dockerfile of dockerfiles) {
      assert.match(dockerfile, /^FROM node:24\.14\.1-alpine@sha256:[0-9a-f]{64}$/m)
      assert.match(dockerfile, /^USER node$/m)
      assert.doesNotMatch(dockerfile, /\bnpx\b|\bpnpx\b/)
    }
    const migratorPackage = JSON.parse(await readFile('docker/migrator/package.json', 'utf8'))
    const migratorProject = JSON.parse(await readFile('docker/migrator/project.json', 'utf8'))
    const entrypoint = await readFile('docker/migrator/entrypoint.sh', 'utf8')
    assert.equal(migratorPackage.packageManager, 'pnpm@10.25.0')
    assert.equal(migratorPackage.dependencies.prisma, '7.8.0')
    assert.deepEqual(migratorProject.tags, ['type:platform', 'runtime:node', 'domain:platform'])
    assert.equal(migratorProject.targets.typecheck.options.command, 'tsc --noEmit -p tsconfig.json')
    assert.match(entrypoint, /prisma migrate deploy/)
    assert.match(entrypoint, /billing-owner-backfill/)
    assert.match(entrypoint, /billing-contract-readiness/)
    assert.doesNotMatch(entrypoint, /\bnpx\b|\bpnpx\b/)
  })
})
