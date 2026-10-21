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

// Pre-existing conflicts, kept visible until they are resolved. Each entry is a dependent
// package name and the pinned dependency; anything not listed fails the test.
const KNOWN_CONFLICTS = new Map([
  // Expo CLI declares zod 3; the shared zod 4 pin has worked through mobile export and device E2E.
  ['@expo/cli zod', 'zod 3 range under the zod 4 pin; covered by mobile export and E2E'],
  // Unexplained pin from an Nx migration checkpoint; review against @simplewebauthn/server (passkeys).
  ...['android', 'cms', 'csr', 'ecc', 'pfx', 'pkcs8', 'pkcs9', 'rsa', 'x509', 'x509-attr'].map(name => [
    `@peculiar/asn1-${name} @peculiar/asn1-schema`,
    'asn1-schema 2.8.0 pin predates the 2.11 family'
  ]),
  // Pinned on purpose to match TanStack Start; Dependabot moved the router packages ahead of it.
  ...['@tanstack/react-router', '@tanstack/router-generator', '@tanstack/router-plugin'].map(name => [
    `${name} @tanstack/router-core`,
    'router-core pin must be raised together with TanStack Start'
  ])
])

test('a global override never breaks a range that an installed package declares', () => {
  const workspace = parse(readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8'))
  const pins = globalPins(workspace.overrides)
  assert.ok(
    pins.some(([name]) => name === 'zod'),
    'zod is pinned so every library shares one schema runtime'
  )

  const conflicts = new Set()
  for (const manifest of installedManifests(resolve(root, 'node_modules/.pnpm'))) {
    for (const [name, version] of pins) {
      for (const field of ['dependencies', 'peerDependencies']) {
        const range = manifest[field]?.[name]
        if (KNOWN_CONFLICTS.has(`${manifest.name} ${name}`)) continue
        if (range && semver.validRange(range) && !semver.satisfies(version, range))
          conflicts.add(`${manifest.name}@${manifest.version} ${field} ${name}@${range}, pinned to ${version}`)
      }
    }
  }
  // Better Auth 1.7 needs zod >=4.5.4 (z.validate); a 4.4.3 pin crashed every forwarded request.
  assert.deepEqual([...conflicts], [])
})

test('global pins are told apart from scoped security floors', () => {
  assert.deepEqual(
    globalPins({
      zod: '4.6.7',
      '@peculiar/asn1-schema': '2.8.0',
      'nx@23.2.1>axios': '1.20.0',
      'follow-redirects@>=1.16.0 <1.16.1': '1.16.1',
      'link-package': 'link:../x'
    }).map(([name]) => name),
    ['zod', '@peculiar/asn1-schema']
  )
})
