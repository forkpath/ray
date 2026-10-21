import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'

import { parse } from 'yaml'

const root = resolve(import.meta.dirname, '../..')
// semver is not a root dependency; nx ships it.
const semver = createRequire(createRequire(import.meta.url).resolve('nx/package.json'))('semver')

/**
 * Overrides that pin a package for the whole graph (`zod: 4.6.7`), as opposed to
 * selector-scoped (`a>b`) or range-scoped (`pkg@<1.2.3`) security floors.
 */
export function globalPins(overrides) {
  return Object.entries(overrides ?? {}).filter(
    ([selector, version]) => !selector.includes('>') && !/^@?[^@]+@/.test(selector) && semver.valid(version)
  )
}

/**
 * The version a dependent actually receives for a globally pinned name: a scoped
 * `parent>name` (or `parent@range>name`) override wins over the global pin.
 */
export function pinFor(overrides, dependent, name, globalVersion) {
  for (const [selector, version] of Object.entries(overrides ?? {})) {
    const match = /^(@?[^@>]+)(?:@([^>]+))?>(.+)$/.exec(selector)
    if (!match || match[1] !== dependent.name || match[3] !== name) continue
    if (!match[2] || semver.satisfies(dependent.version, match[2])) return version
  }
  return globalVersion
}

/** `name@version` of every package the lockfile resolves; the store can hold stale leftovers. */
function lockedPackages(lockfile) {
  return new Set(Object.keys(lockfile.packages ?? {}))
}

function* installedManifests(store) {
  for (const entry of readdirSync(store)) {
    const modules = resolve(store, entry, 'node_modules')
    let names
    try {
      names = readdirSync(modules)
    } catch {
      continue
    }
    for (const name of names) {
      const packages = name.startsWith('@')
        ? readdirSync(resolve(modules, name)).map(child => `${name}/${child}`)
        : [name]
      for (const pkg of packages) {
        try {
          yield JSON.parse(readFileSync(resolve(modules, pkg, 'package.json'), 'utf8'))
        } catch {
          // Symlinks to sibling packages and entries without a manifest carry no ranges.
        }
      }
    }
  }
}

test('a global override never breaks a range that an installed package declares', () => {
  const workspace = parse(readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8'))
  const locked = lockedPackages(parse(readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8')))
  const pins = globalPins(workspace.overrides)
  assert.ok(
    pins.some(([name]) => name === 'zod'),
    'zod is pinned so every library shares one schema runtime'
  )

  const conflicts = new Set()
  let checked = 0
  for (const manifest of installedManifests(resolve(root, 'node_modules/.pnpm'))) {
    if (!locked.has(`${manifest.name}@${manifest.version}`)) continue
    checked++
    for (const [name, globalVersion] of pins) {
      const version = pinFor(workspace.overrides, manifest, name, globalVersion)
      for (const field of ['dependencies', 'peerDependencies']) {
        const range = manifest[field]?.[name]
        if (range && semver.validRange(range) && !semver.satisfies(version, range))
          conflicts.add(`${manifest.name}@${manifest.version} ${field} ${name}@${range}, pinned to ${version}`)
      }
    }
  }
  assert.ok(checked > 1000, `only ${checked} locked packages are installed; run pnpm install --frozen-lockfile`)
  // Better Auth 1.7 needs zod >=4.5.4 (z.validate); a 4.4.3 pin crashed every forwarded request.
  assert.deepEqual([...conflicts], [])
})

test('global pins are told apart from scoped security floors', () => {
  assert.deepEqual(
    globalPins({
      zod: '4.6.7',
      '@peculiar/asn1-schema': '2.11.0',
      'nx@23.2.1>axios': '1.20.0',
      'follow-redirects@>=1.16.0 <1.16.1': '1.16.1',
      'link-package': 'link:../x'
    }).map(([name]) => name),
    ['zod', '@peculiar/asn1-schema']
  )
})

test('a scoped override replaces the global pin for its parent only', () => {
  const overrides = { zod: '4.6.7', '@expo/cli>zod': '3.25.76', 'h3@2.0.1-rc.20>srvx': '0.11.22' }
  assert.equal(pinFor(overrides, { name: '@expo/cli', version: '57.0.26' }, 'zod', '4.6.7'), '3.25.76')
  assert.equal(pinFor(overrides, { name: 'better-auth', version: '1.7.11' }, 'zod', '4.6.7'), '4.6.7')
  assert.equal(pinFor(overrides, { name: 'h3', version: '2.0.1-rc.20' }, 'srvx', '0.11.0'), '0.11.22')
  assert.equal(pinFor(overrides, { name: 'h3', version: '2.0.0' }, 'srvx', '0.11.0'), '0.11.0')
})
