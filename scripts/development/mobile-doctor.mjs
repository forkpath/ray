import { access, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'

import { root } from './config.mjs'
import { run } from './process.mjs'

export function readProperty(source, key) {
  return source
    .split(/\r?\n/)
    .map(line => line.split('=').map(value => value.trim()))
    .find(([name]) => name === key)?.[1]
}

export function javaMajor(output) {
  const version = output.match(/(?:openjdk|java)\s+(?:version\s+)?"?(\d+)(?:\.(\d+))?/)
  if (!version) throw new Error('Cannot determine Java version; check java --version and PATH')
  return Number(version[1] === '1' ? version[2] : version[1])
}

export async function checkMobileTools({
  check,
  platform = 'all',
  e2e = false,
  env = process.env,
  directory = root,
  host = process.platform,
  arch = process.arch,
  command = run
}) {
  const tools = JSON.parse(await readFile(resolve(directory, 'scripts/testing/mobile-tools.json'), 'utf8'))
  const execute = (name, args) => command(name, args, { env, capture: true, timeout: 30_000 })
  const file = async path => {
    try {
      await access(path)
    } catch {
      throw new Error(`Missing ${path}`)
    }
  }
  if (e2e) {
    await check('E2E Maestro', async () => {
      const binary =
        env.RAY_MAESTRO_BIN ??
        resolve(directory, `.cache/testing-tools/maestro-${tools.maestroVersion}/maestro/bin/maestro`)
      const version = await execute(binary, ['--version'])
      if (!version.split(/\s+/).includes(tools.maestroVersion))
        throw new Error(`Expected Maestro ${tools.maestroVersion}; got ${version}`)
    })
  }
  if (platform !== 'ios' || e2e) {
    await check(e2e ? 'E2E Java' : 'Android Java', async () => {
      const actual = javaMajor(await execute('java', ['--version']))
      if (e2e ? actual !== tools.javaMajor : actual < 17)
        throw new Error(`Expected Java ${e2e ? tools.javaMajor : '17 or newer'}; got ${actual}. Set JAVA_HOME and PATH`)
      if (env.JAVA_HOME) {
        const selected = javaMajor(await execute(resolve(env.JAVA_HOME, 'bin/java'), ['--version']))
        if (selected !== actual) throw new Error(`PATH selects Java ${actual}, JAVA_HOME selects ${selected}`)
      }
    })
  }
  if (platform !== 'ios') {
    const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT ?? resolve(env.HOME ?? homedir(), 'Library/Android/sdk')
    await check('Android build SDK/NDK', async () => {
      const require = createRequire(resolve(directory, 'apps/mobile/package.json'))
      const reactNative = dirname(require.resolve('react-native/package.json'))
      const versions = await readFile(resolve(reactNative, 'gradle/libs.versions.toml'), 'utf8')
      const version = name => {
        const value = versions.match(new RegExp(`^${name}\\s*=\\s*"([^"]+)"`, 'm'))?.[1]
        if (!value) throw new Error(`Missing React Native ${name} version`)
        return value
      }
      for (const path of [
        `platforms/android-${version('compileSdk')}/android.jar`,
        `build-tools/${version('buildTools')}/source.properties`,
        `ndk/${version('ndkVersion')}/source.properties`
      ])
        await file(resolve(sdk, path))
      const gradle = await readFile(resolve(reactNative, 'ReactAndroid/build.gradle.kts'), 'utf8')
      const cmake = (!e2e && env.CMAKE_VERSION) || gradle.match(/val cmakeVersion = .*\?: "([^"]+)"/)?.[1]
      if (!cmake) throw new Error('Cannot determine React Native CMake version')
      await file(resolve(sdk, `cmake/${cmake}/bin/cmake${host === 'win32' ? '.exe' : ''}`))
    })
    await check('Android platform tools', () => execute(resolve(sdk, 'platform-tools/adb'), ['version']))
    if (e2e) {
      await check('E2E Android system image', async () => {
        if (!['arm64', 'x64'].includes(arch)) throw new Error(`Unsupported emulator host architecture: ${arch}`)
        const abi = arch === 'arm64' ? 'arm64-v8a' : 'x86_64'
        const image = resolve(sdk, `system-images/android-${tools.androidApi}/${tools.androidImageVariant}/${abi}`)
        await file(resolve(image, 'system.img'))
        const properties = await readFile(resolve(image, 'source.properties'), 'utf8')
        if (readProperty(properties, 'Pkg.Revision') !== String(tools.androidImageRevision))
          throw new Error(
            `Expected image revision ${tools.androidImageRevision}; got ${readProperty(properties, 'Pkg.Revision')}`
          )
      })
      await check('E2E Android AVD manager', () => file(resolve(sdk, 'cmdline-tools/latest/bin/avdmanager')))
      await check('E2E Android acceleration', () => execute(resolve(sdk, 'emulator/emulator'), ['-accel-check']))
    }
  }
  if (platform !== 'android') {
    if (host !== 'darwin') {
      if (platform === 'ios')
        await check('iOS host', async () => {
          throw new Error('iOS requires macOS')
        })
      else console.log('SKIP iOS: requires macOS')
      return
    }
    await check('iOS Xcode', async () => {
      const selected = await execute('xcodebuild', ['-version'])
      const version = selected.match(/^Xcode (\d+)\.(\d+)(?:\.\d+)?(?:\r?\n|$)/)
      // Expo SDK 57 minimum: https://docs.expo.dev/versions/latest/
      if (!version || Number(version[1]) < 26 || (Number(version[1]) === 26 && Number(version[2]) < 4))
        throw new Error(`Expo SDK 57 requires Xcode 26.4 or newer; got ${selected.trim() || 'empty output'}`)
      if (e2e && !selected.startsWith(`Xcode ${tools.xcodeVersion}\n`))
        throw new Error(`E2E expects Xcode ${tools.xcodeVersion}; selected ${selected.split('\n')[0]}`)
      await execute('xcodebuild', ['-checkFirstLaunchStatus'])
      await execute('xcrun', ['--sdk', 'iphoneos', '--show-sdk-version'])
    })
    await check('iOS CocoaPods', () => execute('pod', ['--version']))
    if (e2e)
      await check('E2E iOS simulator', async () => {
        const runtimes = JSON.parse(await execute('xcrun', ['simctl', 'list', 'runtimes', '-j']))
        if (!runtimes.runtimes.some(runtime => runtime.identifier === tools.iosRuntime && runtime.isAvailable))
          throw new Error(`Missing available runtime ${tools.iosRuntime}`)
        const types = JSON.parse(await execute('xcrun', ['simctl', 'list', 'devicetypes', '-j']))
        if (!types.devicetypes.some(type => type.identifier === tools.iosDeviceType))
          throw new Error(`Missing device type ${tools.iosDeviceType}`)
      })
  }
}
