import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'

import { checkMobileTools, javaMajor, readProperty } from '../development/mobile-doctor.mjs'

test('Java and SDK metadata parsing accepts real output and CRLF', () => {
  assert.equal(javaMajor('openjdk 21.0.12.1 2026-08-18 LTS'), 21)
  assert.equal(javaMajor('java version "1.8.0_402"'), 8)
  assert.throws(() => javaMajor(''), /Cannot determine/)
  assert.equal(readProperty('Pkg.Revision = 7\r\n', 'Pkg.Revision'), '7')
})

async function fixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'ray-mobile-doctor-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  async function put(path, content = '') {
    const destination = resolve(directory, path)
    await mkdir(resolve(destination, '..'), { recursive: true })
    await writeFile(destination, content)
  }
  await put(
    'scripts/testing/mobile-tools.json',
    JSON.stringify({
      javaMajor: 21,
      androidApi: 36,
      androidImageVariant: 'google_apis',
      androidImageRevision: 7,
      maestroVersion: '2.10.0',
      xcodeVersion: '26.6',
      iosRuntime: 'runtime',
      iosDeviceType: 'device'
    })
  )
  await put('apps/mobile/package.json', '{}')
  await put('node_modules/react-native/package.json', '{}')
  await put(
    'node_modules/react-native/gradle/libs.versions.toml',
    'compileSdk = "36"\nbuildTools = "36.0.0"\nndkVersion = "27.1"'
  )
  await put(
    'node_modules/react-native/ReactAndroid/build.gradle.kts',
    'val cmakeVersion = System.getenv("CMAKE_VERSION") ?: "3.30.5"'
  )
  for (const path of [
    'platforms/android-36/android.jar',
    'build-tools/36.0.0/source.properties',
    'ndk/27.1/source.properties',
    'cmake/3.30.5/bin/cmake',
    'cmdline-tools/latest/bin/avdmanager',
    'system-images/android-36/google_apis/x86_64/system.img'
  ])
    await put(`sdk/${path}`)
  await put('sdk/system-images/android-36/google_apis/x86_64/source.properties', 'Pkg.Revision=7\r\n')
  const failures = []
  const commands = []
  const env = {
    ANDROID_HOME: resolve(directory, 'sdk'),
    JAVA_HOME: '/selected/jdk',
    RAY_MAESTRO_BIN: '/selected/maestro'
  }
  const command = async (name, args, options) => {
    commands.push({ name, args, env: options.env })
    if (args[0] === '--version') return name.includes('maestro') ? '2.10.0' : 'openjdk 21.0.1'
    if (name === 'xcodebuild' && args[0] === '-version') return 'Xcode 26.5\nBuild version test'
    if (args.includes('runtimes')) return JSON.stringify({ runtimes: [{ identifier: 'runtime', isAvailable: true }] })
    if (args.includes('devicetypes')) return JSON.stringify({ devicetypes: [{ identifier: 'device' }] })
    return 'OK'
  }
  return {
    directory,
    env,
    command,
    commands,
    failures,
    host: 'darwin',
    arch: 'x64',
    check: async (label, operation) => {
      try {
        await operation()
      } catch (error) {
        failures.push({ label, message: error.message })
      }
    }
  }
}

test('Android build checks do not require Docker, Maestro or a pinned E2E image', async t => {
  const options = await fixture(t)
  await rm(resolve(options.directory, 'sdk/system-images'), { recursive: true })
  await checkMobileTools({ ...options, platform: 'android' })
  assert.deepEqual(options.failures, [])
  assert.ok(options.commands.every(({ name }) => !name.includes('docker') && !name.includes('maestro')))
  assert.ok(options.commands.every(({ env }) => env === options.env))
})

test('missing compile platform fails even with a newer platform installed', async t => {
  const options = await fixture(t)
  await rm(resolve(options.directory, 'sdk/platforms/android-36'), { recursive: true })
  await mkdir(resolve(options.directory, 'sdk/platforms/android-37'), { recursive: true })
  await checkMobileTools({ ...options, platform: 'android' })
  assert.match(options.failures[0].message, /android-36\/android.jar/)
})

test('E2E detects image revision mismatch and honors Maestro override', async t => {
  const options = await fixture(t)
  await writeFile(
    resolve(options.directory, 'sdk/system-images/android-36/google_apis/x86_64/source.properties'),
    'Pkg.Revision=8\n'
  )
  await checkMobileTools({ ...options, platform: 'android', e2e: true })
  assert.deepEqual(
    options.failures.map(item => item.label),
    ['E2E Android system image']
  )
  assert.match(options.failures[0].message, /Expected image revision 7; got 8/)
  assert.ok(options.commands.some(({ name }) => name === '/selected/maestro'))
})

test('iOS build permits selected Xcode while E2E enforces its exact pin', async t => {
  const options = await fixture(t)
  await checkMobileTools({ ...options, platform: 'ios' })
  assert.deepEqual(options.failures, [])
  await checkMobileTools({ ...options, platform: 'ios', e2e: true })
  assert.deepEqual(
    options.failures.map(item => item.label),
    ['iOS Xcode']
  )
})

test('Java selected through PATH must match JAVA_HOME', async t => {
  const options = await fixture(t)
  const command = (name, args, settings) =>
    name === '/selected/jdk/bin/java' ? Promise.resolve('openjdk 17.0.1') : options.command(name, args, settings)
  await checkMobileTools({ ...options, command, platform: 'android' })
  assert.match(options.failures[0].message, /PATH selects Java 21, JAVA_HOME selects 17/)
})

test('iOS rejects Xcode below the Expo minimum and unparseable output', async t => {
  for (const output of ['Xcode 26.3\nBuild version test', 'Xcode 16.1\nBuild version test', '']) {
    const options = await fixture(t)
    const command = (name, args, settings) =>
      name === 'xcodebuild' && args[0] === '-version' ? Promise.resolve(output) : options.command(name, args, settings)
    await checkMobileTools({ ...options, command, platform: 'ios' })
    assert.match(options.failures[0].message, /requires Xcode 26.4 or newer/)
  }
})

test('E2E checks the runner CMake default even when a local override exists', async t => {
  const options = await fixture(t)
  options.env.CMAKE_VERSION = '3.31.0'
  await rm(resolve(options.directory, 'sdk/cmake/3.30.5'), { recursive: true })
  await mkdir(resolve(options.directory, 'sdk/cmake/3.31.0/bin'), { recursive: true })
  await writeFile(resolve(options.directory, 'sdk/cmake/3.31.0/bin/cmake'), '')
  await checkMobileTools({ ...options, platform: 'android' })
  assert.deepEqual(options.failures, [])
  await checkMobileTools({ ...options, platform: 'android', e2e: true })
  assert.match(options.failures[0].message, /cmake\/3.30.5\/bin\/cmake/)
})
