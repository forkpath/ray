import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'

import { verifyMobileBundle } from './mobile-bundle.mjs'
import { terminateProcessTree } from './process-tree.mjs'

const platform = process.argv[2]
if (!['android', 'ios'].includes(platform)) throw new Error('Use pnpm nx run mobile:e2e:android or mobile:e2e:ios')
if (platform === 'ios' && process.platform !== 'darwin') throw new Error('iOS device tests require macOS and Xcode.')
if (!['darwin', 'linux'].includes(process.platform))
  throw new Error('The local device runner supports macOS and Linux.')

const root = resolve(import.meta.dirname, '../..')
const tools = JSON.parse(await readFile(resolve(import.meta.dirname, 'mobile-tools.json'), 'utf8'))
const profile = JSON.parse(await readFile(resolve(root, 'apps/mobile/eas.json'), 'utf8')).build.e2e
const runId = randomBytes(8).toString('hex')
const report = resolve(root, `dist/test-results/mobile/e2e/${platform}/${runId}`)
await mkdir(report, { recursive: true })
const log = createWriteStream(resolve(report, 'runner.log'))
const children = new Set()
const timings = []
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) =>
    /^(PATH|HOME|USER|TMPDIR|TMP|TEMP|LANG|LC_.*|JAVA_HOME|ANDROID_HOME|ANDROID_SDK_ROOT|DEVELOPER_DIR|CI)$/.test(key)
  )
)
Object.assign(env, {
  ...profile.env,
  CI: '1',
  NODE_ENV: 'production',
  EXPO_NO_DOTENV: '1',
  NX_LOAD_DOT_ENV_FILES: 'false',
  SENTRY_DISABLE_AUTO_UPLOAD: 'true',
  MAESTRO_CLI_NO_ANALYTICS: '1',
  MAESTRO_DRIVER_STARTUP_TIMEOUT: '180000',
  RAY_MOBILE_E2E: 'true',
  EXPO_PUBLIC_DEFAULT_LOCALE: 'en',
  EXPO_PUBLIC_AUTH_PASSWORD: 'true',
  EXPO_PUBLIC_AUTH_ANONYMOUS: 'false',
  EXPO_PUBLIC_ANALYTICS_PROVIDER: 'posthog',
  EXPO_PUBLIC_MONITORING_PROVIDER: 'sentry'
})
let interrupted = false
let cleaning = false
let device
let emulator
let androidLogcat
let deviceOwned = false
let workspace
let passed = false
let cleaned = true
let commandIndex = 0

function interrupt() {
  interrupted = true
  process.exitCode = 1
  if (!cleaning)
    for (const child of children) {
      try {
        terminateProcessTree(child.pid, 'SIGTERM')
      } catch (error) {
        cleaned = false
        log.write(`Interrupted process cleanup: ${error.message}\n`)
        child.kill('SIGKILL')
      }
    }
}
process.on('SIGINT', interrupt)
process.on('SIGTERM', interrupt)

function command(
  executable,
  args,
  { cwd = root, timeout = 120_000, input, background = false, captureAll = false, logName } = {}
) {
  if (interrupted && !cleaning) throw new Error('Mobile test interrupted')
  log.write(`\n${executable} ${args.join(' ')}\n`)
  const commandName = `${++commandIndex}-${executable.split('/').at(-1)}.log`
  const stream = createWriteStream(resolve(report, logName ?? commandName))
  const started = Date.now()
  const child = spawn(executable, args, { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] })
  children.add(child)
  let output = ''
  const capture = chunk => {
    output = captureAll ? output + chunk : (output + chunk).slice(-64_000)
    stream.write(chunk)
  }
  child.stdout.on('data', capture)
  child.stderr.on('data', capture)
  child.stdin.end(input)
  const completion = new Promise((resolveResult, reject) => {
    const timer = setTimeout(() => {
      try {
        terminateProcessTree(child.pid, 'SIGKILL')
      } catch (error) {
        cleaned = false
        log.write(`Timed out process cleanup: ${error.message}\n`)
        child.kill('SIGKILL')
      }
    }, timeout)
    child.once('error', reject)
    child.once('close', (code, signal) => {
      clearTimeout(timer)
      timings.push({ command: commandName, milliseconds: Date.now() - started, code, signal })
      children.delete(child)
      stream.end(() => {
        if (code === 0) resolveResult(output.trim())
        else reject(new Error(`${executable} failed (${signal ?? code}): ${output.slice(-4000)}`))
      })
    })
  })
  // Keep background failures observable without unhandled rejections.
  if (background) {
    completion.catch(() => undefined)
    return { child, completion }
  }
  return completion
}

const requests = []
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://127.0.0.1').pathname
  requests.push({ method: request.method, path })
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  // An external signed-out fixture. The app's auth client and navigation are real.
  if (
    request.method === 'GET' &&
    [
      '/api/auth/get-session',
      '/api/auth/organization/get-full-organization',
      '/api/auth/organization/get-active-member'
    ].includes(path)
  )
    return response.end('null')
  response.statusCode = 404
  response.end(JSON.stringify({ message: 'No fixture for this request' }))
})

const sdk = env.ANDROID_HOME ?? env.ANDROID_SDK_ROOT ?? resolve(env.HOME, 'Library/Android/sdk')
const adb = resolve(sdk, 'platform-tools/adb')
const avdmanager = resolve(sdk, 'cmdline-tools/latest/bin/avdmanager')
const maestro =
  process.env.RAY_MAESTRO_BIN ??
  resolve(root, `.cache/testing-tools/maestro-${tools.maestroVersion}/maestro/bin/maestro`)
const appId = 'com.ray.mobile.e2e'
const iosRuntime = tools.iosRuntime
const avdName = `ray-e2e-${runId}`
const arch = process.arch === 'arm64' ? 'arm64-v8a' : 'x86_64'

try {
  const maestroVersion = await command(maestro, ['--version'])
  if (!maestroVersion.split(/\s+/).includes(tools.maestroVersion))
    throw new Error(`Expected Maestro ${tools.maestroVersion}; got ${maestroVersion}`)
  const javaVersion = await command('java', ['-version'])
  if (!javaVersion.includes(`version "${tools.javaMajor}.`)) throw new Error(`Java ${tools.javaMajor} is required`)
  if (platform === 'ios') {
    const xcode = await command('xcodebuild', ['-version'])
    if (!xcode.startsWith(`Xcode ${tools.xcodeVersion}\n`))
      throw new Error(`Expected Xcode ${tools.xcodeVersion} (Expo 57 requires 26.4 or newer): ${xcode}`)
    const runtimes = JSON.parse(await command('xcrun', ['simctl', 'list', 'runtimes', '-j'], { captureAll: true }))
    if (!runtimes.runtimes.some(runtime => runtime.identifier === iosRuntime && runtime.isAvailable))
      throw new Error(`Missing simulator runtime: ${iosRuntime}`)
  } else {
    await stat(
      resolve(sdk, `system-images/android-${tools.androidApi}/${tools.androidImageVariant}/${arch}/system.img`)
    )
    const imageProperties = await readFile(
      resolve(sdk, `system-images/android-${tools.androidApi}/${tools.androidImageVariant}/${arch}/source.properties`),
      'utf8'
    )
    if (!imageProperties.includes(`Pkg.Revision=${tools.androidImageRevision}\n`))
      throw new Error('Android system image revision differs from mobile-tools.json')
    env.ANDROID_HOME = sdk
    env.ANDROID_SDK_ROOT = sdk
    await copyFile(resolve(sdk, 'emulator/source.properties'), resolve(report, 'emulator.properties'))
    await command(resolve(sdk, 'emulator/emulator'), ['-accel-check'])
  }

  await new Promise((resolveReady, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveReady)
  })
  const port = server.address().port
  env.EXPO_PUBLIC_API_BASE_URL = `http://127.0.0.1:${port}`
  env.EXPO_PUBLIC_SITE_URL = env.EXPO_PUBLIC_API_BASE_URL
  workspace = await mkdtemp(resolve(tmpdir(), `ray-mobile-${platform}-`))
  const files = (
    await command('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { captureAll: true })
  ).split('\0')
  const rootConfigFiles = new Set([
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'nx.json',
    'tsconfig.base.json'
  ])
  for (const file of new Set(files)) {
    if (!file || /(^|\/)\.env(?:[./]|$)/.test(file)) continue
    if (!file.startsWith('apps/mobile/') && !file.startsWith('libs/') && !rootConfigFiles.has(file)) continue
    const target = resolve(workspace, file)
    await mkdir(dirname(target), { recursive: true })
    try {
      await copyFile(resolve(root, file), target)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  await symlink(resolve(root, 'node_modules'), resolve(workspace, 'node_modules'), 'dir')
  await symlink(resolve(root, 'apps/mobile/node_modules'), resolve(workspace, 'apps/mobile/node_modules'), 'dir')
  const app = resolve(workspace, 'apps/mobile')
  const packagePath = resolve(app, 'package.json')
  const appPackage = JSON.parse(await readFile(packagePath, 'utf8'))
  if (appPackage.main === 'expo-router/entry') {
    // Keep the native bundle entry inside this copy even when dependencies are symlinked.
    appPackage.main = './.ray-e2e-entry.js'
    await writeFile(resolve(app, '.ray-e2e-entry.js'), "import 'expo-router/entry'\n")
    await writeFile(packagePath, `${JSON.stringify(appPackage, null, 2)}\n`)
  }
  const expo = resolve(app, 'node_modules/expo/bin/cli')
  await command(
    process.execPath,
    [expo, 'prebuild', '--platform', platform, '--no-install', '--skip-dependency-update', 'react,react-native'],
    { cwd: app, timeout: 300_000 }
  )
  console.log(`Mobile ${platform}: native project prepared; building embedded release bundle.`)
  let artifact
  if (platform === 'android') {
    // Expo's generated release variant uses the debug keystore for this isolated app.
    const buildDeadline = Date.now() + 3_600_000
    const gradleArgs = [
      '--no-daemon',
      '--build-cache',
      '--max-workers=2',
      '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m',
      `-PreactNativeArchitectures=${arch}`
    ]
    // Fail before compiling native dependencies if the copied app's routes are absent.
    await command('sh', ['./gradlew', ':app:createBundleReleaseJsAndAssets', ...gradleArgs], {
      cwd: resolve(app, 'android'),
      timeout: 900_000
    })
    const sourceMapPath = resolve(app, 'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map')
    const sourceMap = JSON.parse(await readFile(sourceMapPath, 'utf8'))
    await writeFile(resolve(report, 'bundle-sources.json'), JSON.stringify(verifyMobileBundle(sourceMap), null, 2))
    console.log('Mobile android: application routes verified in the release bundle; assembling APK.')
    await command('sh', ['./gradlew', ':app:assembleRelease', ...gradleArgs], {
      cwd: resolve(app, 'android'),
      timeout: Math.max(1, buildDeadline - Date.now())
    })
    // Gradle may regenerate the bundle while assembling the final APK.
    await writeFile(
      resolve(report, 'bundle-final-sources.json'),
      JSON.stringify(verifyMobileBundle(JSON.parse(await readFile(sourceMapPath, 'utf8'))), null, 2)
    )
    artifact = resolve(report, 'app-release.apk')
    await copyFile(resolve(app, 'android/app/build/outputs/apk/release/app-release.apk'), artifact)
    // The installed APK and reports no longer need this owned native build tree.
    // Reclaim its intermediates before allocating the emulator's data partition.
    await rm(resolve(app, 'android'), { recursive: true, force: true })
    await writeFile(resolve(report, 'native-build.json'), JSON.stringify({ platform, runId }))
    console.log('Mobile android: release APK built; starting the isolated emulator.')
    env.ANDROID_AVD_HOME = resolve(workspace, 'avd')
    await mkdir(env.ANDROID_AVD_HOME)
    await command(
      avdmanager,
      [
        'create',
        'avd',
        '--name',
        avdName,
        '--package',
        `system-images;android-${tools.androidApi};${tools.androidImageVariant};${arch}`,
        '--device',
        'pixel_6'
      ],
      { input: 'no\n' }
    )
    // Choose an unused even console port; the emulator reserves its companion port.
    const devices = await command(adb, ['devices'])
    let consolePort = 5554
    while (devices.includes(`emulator-${consolePort}`)) consolePort += 2
    device = `emulator-${consolePort}`
    emulator = command(
      resolve(sdk, 'emulator/emulator'),
      [
        '-avd',
        avdName,
        '-port',
        String(consolePort),
        '-no-window',
        '-no-audio',
        '-no-snapshot',
        '-no-boot-anim',
        '-gpu',
        'swiftshader',
        ...(process.platform === 'darwin' ? ['-feature', '-Vulkan'] : []),
        // Private-repository hosted runners have 2 vCPUs, and KVM rejects more. The API 36
        // Google APIs image starved there (watchdog restarts, ANRs), so mobile-tools.json pins
        // the lighter Automated Test Device (google_atd) image; memory is above its minimum.
        '-memory',
        '4096',
        '-cores',
        '2'
      ],
      { background: true, timeout: 1_800_000 }
    )
    await Promise.race([
      command(adb, ['-s', device, 'wait-for-device']),
      emulator.completion.then(() => {
        throw new Error('Android emulator exited before becoming available')
      })
    ])
    const actualAvd = await command(adb, ['-s', device, 'emu', 'avd', 'name'])
    if (!actualAvd.split(/\s+/).includes(avdName)) throw new Error('Refusing to use an emulator owned by another run')
    deviceOwned = true
    androidLogcat = command(adb, ['-s', device, 'logcat', '-v', 'threadtime'], {
      background: true,
      timeout: 1_800_000,
      logName: 'device-live.log'
    })
    const deadline = Date.now() + 600_000
    while ((await command(adb, ['-s', device, 'shell', 'getprop', 'sys.boot_completed'])) !== '1') {
      if (Date.now() > deadline || emulator.child.exitCode !== null) throw new Error('Android emulator failed to boot')
      await new Promise(resolveTick => setTimeout(resolveTick, 1000))
    }
    // API 36 keeps starting system services after sys.boot_completed, and a starved system
    // server can be restarted by its watchdog. Before each install attempt, wait until the
    // package manager answers and apply the test settings again.
    const prepareDevice = async () => {
      const packageDeadline = Date.now() + 300_000
      while (
        !(await command(adb, ['-s', device, 'shell', 'pm', 'path', 'android']).catch(() => '')).startsWith('package:')
      ) {
        if (Date.now() > packageDeadline || emulator.child.exitCode !== null) {
          throw new Error('Android package manager did not become ready')
        }
        await new Promise(resolveTick => setTimeout(resolveTick, 3000))
      }
      for (const [key, value] of [
        // Play Protect verification of adb installs waits on Google Play services; it only
        // vets the install source, and the app under test runs unchanged.
        ['verifier_verify_adb_installs', '0'],
        ['package_verifier_enable', '0'],
        // "System UI isn't responding" can cover the app. A crashed app still fails the flows,
        // because it never renders the screens they wait for.
        ['hide_error_dialogs', '1'],
        // Less rendering work for the system server; flows wait on elements, not on animations.
        ['window_animation_scale', '0'],
        ['transition_animation_scale', '0'],
        ['animator_duration_scale', '0']
      ]) {
        await command(adb, ['-s', device, 'shell', 'settings', 'put', 'global', key, value])
      }
      await command(adb, ['-s', device, 'reverse', `tcp:${port}`, `tcp:${port}`])
    }
    await prepareDevice()
    for (let attempt = 1; ; attempt++) {
      try {
        await command(adb, ['-s', device, 'install', '-r', artifact], { timeout: 600_000 })
        break
      } catch (error) {
        if (attempt >= 3 || emulator.child.exitCode !== null) throw error
        // Recorded in the job log and runner.log, so a flaky lane stays visible after a pass.
        const message = `Android install attempt ${attempt} failed; retrying after the system server settles: ${error.message.split('\n')[0]}`
        console.warn(`Mobile android: ${message}`)
        log.write(`${message}\n`)
        await new Promise(resolveTick => setTimeout(resolveTick, 15_000))
        await prepareDevice()
      }
    }
  } else {
    await command('pod', ['install'], { cwd: resolve(app, 'ios'), timeout: 900_000 })
    const derived = resolve(workspace, 'derived')
    // Keep only content-addressed compiler entries across runs. Build products,
    // fixture URLs, simulator state and test results remain unique to this run.
    const compilationCache = resolve(
      root,
      '.cache/mobile-native/ios',
      `xcode-${tools.xcodeVersion}`,
      'CompilationCache.noindex'
    )
    await mkdir(compilationCache, { recursive: true })
    await command(
      'xcodebuild',
      [
        '-jobs',
        '2',
        '-workspace',
        'RayE2E.xcworkspace',
        '-scheme',
        'RayE2E',
        '-configuration',
        'Release',
        '-sdk',
        'iphonesimulator',
        '-destination',
        'generic/platform=iOS Simulator',
        '-derivedDataPath',
        derived,
        // Xcode embeds simulator entitlements at link time; disabling signing
        // removes the Keychain identity required by the real SecureStore module.
        'CODE_SIGNING_ALLOWED=YES',
        'CODE_SIGN_IDENTITY=-',
        'DEVELOPMENT_TEAM=',
        'COMPILATION_CACHE_ENABLE_CACHING=YES',
        'COMPILATION_CACHE_ENABLE_DIAGNOSTIC_REMARKS=YES',
        `COMPILATION_CACHE_CAS_PATH=${compilationCache}`,
        `ARCHS=${process.arch === 'arm64' ? 'arm64' : 'x86_64'}`,
        'build'
      ],
      { cwd: resolve(app, 'ios'), timeout: 3_600_000 }
    )
    artifact = resolve(report, 'RayE2E.app')
    await cp(resolve(derived, 'Build/Products/Release-iphonesimulator/RayE2E.app'), artifact, { recursive: true })
    // Preserve executable permissions when GitHub uploads/downloads this artifact.
    await command('tar', ['-czf', resolve(report, 'RayE2E.app.tar.gz'), '-C', report, 'RayE2E.app'])
    await writeFile(resolve(report, 'native-build.json'), JSON.stringify({ platform, runId }))
    device = await command('xcrun', ['simctl', 'create', avdName, tools.iosDeviceType, iosRuntime])
    deviceOwned = true
    await command('xcrun', ['simctl', 'boot', device])
    await command('xcrun', ['simctl', 'bootstatus', device, '-b'], { timeout: 180_000 })
    await command('xcrun', ['simctl', 'install', device, artifact])
  }
  console.log(`Mobile ${platform}: ${device} ready; running Maestro flows.`)
  await command(
    maestro,
    [
      '--device',
      device,
      'test',
      '--format',
      'JUNIT',
      '--output',
      resolve(report, 'junit.xml'),
      '--test-output-dir',
      resolve(report, 'maestro'),
      '--debug-output',
      resolve(report, 'debug'),
      resolve(root, 'apps/mobile/.maestro')
    ],
    { timeout: 600_000 }
  )
  if (!(await readFile(resolve(report, 'junit.xml'), 'utf8')).includes('<testcase'))
    throw new Error('Maestro produced no test cases')
  if (!requests.some(request => request.path === '/api/auth/get-session'))
    throw new Error('The app never reached the signed-out session fixture')
  passed = !interrupted
} catch (error) {
  console.error(error.message)
  log.write(`${error.stack}\n`)
  process.exitCode = 1
} finally {
  cleaning = true
  async function cleanup(action) {
    try {
      await action()
    } catch (error) {
      cleaned = false
      log.write(`Cleanup: ${error.message}\n`)
      process.exitCode = 1
    }
  }
  if (deviceOwned) {
    if (platform === 'android') {
      await cleanup(async () =>
        writeFile(
          resolve(report, 'device.log'),
          await command(adb, ['-s', device, 'logcat', '-d', '-t', '2000'], { captureAll: true })
        )
      )
    } else {
      await cleanup(() =>
        command('xcrun', [
          'simctl',
          'spawn',
          device,
          'log',
          'show',
          '--last',
          '5m',
          '--predicate',
          `process == "RayE2E"`
        ])
      )
      await cleanup(() => command('xcrun', ['simctl', 'shutdown', device]))
      await cleanup(() => command('xcrun', ['simctl', 'delete', device]))
    }
  }
  for (const child of children) {
    await cleanup(() => {
      try {
        terminateProcessTree(child.pid, 'SIGKILL')
      } catch (error) {
        child.kill('SIGKILL')
        throw error
      }
    })
  }
  if (emulator) await emulator.completion.catch(() => undefined)
  if (androidLogcat) await androidLogcat.completion.catch(() => undefined)
  server.closeAllConnections()
  await new Promise(resolveClosed => server.close(resolveClosed))
  if (workspace) await cleanup(() => rm(workspace, { recursive: true, force: true }))
  await writeFile(resolve(report, 'timings.json'), JSON.stringify(timings, null, 2))
  await writeFile(resolve(report, 'fixture-requests.json'), JSON.stringify(requests, null, 2))
  await writeFile(
    resolve(report, 'run.json'),
    JSON.stringify(
      {
        platform,
        runId,
        appId,
        tools,
        iosRuntime: platform === 'ios' ? iosRuntime : undefined,
        passed,
        cleaned,
        interrupted
      },
      null,
      2
    )
  )
  await new Promise(resolveLog => log.end(resolveLog))
  process.removeListener('SIGINT', interrupt)
  process.removeListener('SIGTERM', interrupt)
  console.log(`Mobile ${platform}: ${passed && cleaned ? 'passed' : 'failed'}; reports: ${report}`)
}
