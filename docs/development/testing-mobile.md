# Mobile 设备测试

Mobile 的快速组件与路由测试使用 `pnpm nx run mobile:test`。设备测试使用
Maestro，运行编入 JS bundle 的原生 Release 测试包：

```sh
node scripts/testing/install-maestro.mjs
pnpm nx run mobile:e2e:android
pnpm nx run mobile:e2e:ios
```

安装脚本下载固定版本并校验 SHA-256，只写仓库 `.cache/testing-tools`，不会
更改系统 Maestro。已有相同版本可用 `RAY_MAESTRO_BIN` 指定可执行文件。
固定版本和设备配置见 `scripts/testing/mobile-tools.json`。

## 系统前置条件

- Node/pnpm 使用根 `package.json` 锁定版本，先完成冻结锁文件安装。
- Java 21，设置 `JAVA_HOME` 并确认 `java -version`。
- Android SDK、platform-tools、emulator、command-line tools；设置
  `ANDROID_HOME`。原生 SDK/NDK 版本由锁定的 Expo/React Native 构建配置决定。
  设备镜像为 Android 36 / Google APIs / revision 7，Intel 使用 `x86_64`，
  Apple Silicon 使用 `arm64-v8a`。例如使用已安装的 SDK 管理器安装
  `system-images;android-36;google_apis;x86_64`。需要可用的硬件虚拟化。
  构建前检查硬件加速，并记录 SDK 中已安装的 emulator 版本。
- iOS 需要 macOS、Xcode 26.6、CocoaPods，以及配置文件指定的 iOS 26.5
  Simulator runtime。测试构建由 Xcode 使用本地 ad-hoc 签名，不要求开发者
  或商店证书。保留 Xcode 在链接阶段生成的模拟器 entitlements，确保真实
  SecureStore 能访问该测试应用的 Keychain；不能设置 `CODE_SIGNING_ALLOWED=NO`。

Expo 57 的官方最低要求是 Xcode 26.4；本套件固定到 GitHub `macos-26`
已提供的 Xcode 26.6 / iOS 26.5。可用 `DEVELOPER_DIR` 选择并行安装的
Xcode。旧工具链会在构建前明确失败，不修改依赖源码绕过编译器要求。
参见 [Expo 兼容表](https://docs.expo.dev/versions/latest/) 和
[GitHub runner 清单](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md)。

React Native 0.86 预编译库与菜单依赖的链接兼容修复由 pnpm 固定补丁应用，
来源与移除条件见 [依赖补丁说明](../../patches/README.md)。

Mobile 显式声明与 Sentry React Native SDK 匹配的 `@sentry/cli` 开发依赖，
保证 pnpm 隔离安装时 Xcode 脚本能够解析 CLI。设备测试设置
`SENTRY_DISABLE_AUTO_UPLOAD=true`，不上传调试符号，也不要求 Sentry 凭据；
该脚本在判断开关前仍会解析 CLI，因此不能省略这项构建依赖。

缺少工具、版本不匹配或原生构建失败会返回非零并留下报告，不能作为设备通过。
本地构建不要求 EAS 订阅；`eas.json` 同时提供 `e2e` profile，供使用者接入
EAS 构建。云端生成的包需要匹配其 `127.0.0.1:4179` 测试服务；默认本地
入口使用每次运行分配的端口并自动编排整个生命周期。

## 隔离和验收范围

runner 把当前 Git 跟踪及未忽略的 Mobile/共享库源码复制到临时目录，不复制
`.env`；根目录只复制包管理、Nx 与 TS 路径配置，在副本生成 native 工程。
依赖使用已安装的锁定包。正式工作区的
`ios/`、`android/` 和应用配置不会被 prebuild 改写。
默认 Expo Router 入口在副本内包装为本地入口，仍加载真实 `expo-router/entry`，
避免原生打包从副本外的依赖路径启动而遗漏页面。Android 先生成内嵌 bundle，
检查 sourcemap 包含布局、欢迎页和登录页，再编译应用 APK，并复查最终 bundle；
缺失任何页面均失败。保存 APK 和检查报告后删除该次临时 Android 原生编译目录，
为专用模拟器留出空间。当前系统镜像的数据分区至少需要 6 GB，首次创建时
模拟器要求约 7.4 GB 可用磁盘；更小的配置值不能降低这个要求。CI 还会移除
一次性 Ubuntu runner 上未使用的预装 NDK，再安装项目锁定的 27.1.12297006，
保留足够空间给原生构建和模拟器；本地入口不会删除开发者的 SDK。

测试应用是 `com.ray.mobile.e2e` / `Ray E2E`，scheme 为 `ray-e2e`，OTA 关闭。
正式应用仍使用原来的标识和更新配置。测试包允许 HTTP 以连接本机 fixture，不添加
认证绕过逻辑。外部 fixture 返回未登录 session；原生存储、Provider、字体、
Expo Router 和页面交互照常运行。它不验证登录服务本身、OAuth、支付、推送、
签名或真机硬件；后端身份验证由 Engine/Pulse 的真实协议套件负责。

每次运行创建自己的模拟器，安装测试包、重置状态、执行 flows，然后停止和
删除自己的设备/临时目录。不会重置开发者已有模拟器或已安装的正式应用。
Android 通过指定设备的 `adb reverse` 连接临时 fixture。所有等待均有截止时间。
原生构建最多等待 60 分钟，Android 启用 Gradle 自身按输入计算的 build cache，
并限制两个 Gradle worker。测试构建进程最多使用 4 GB Java 堆和 1 GB 元空间，
建议至少 8 GB 可用系统内存；这些参数只传给隔离测试构建。CI 的完整设备 job
最多 90 分钟。

CI 分别持久化 Android 的 Gradle wrapper、依赖和 build cache，以及 iOS 的
CocoaPods 下载缓存与 Xcode 26 内容寻址编译缓存。Xcode 缓存放在仓库
`.cache/mobile-native/ios/xcode-<version>/CompilationCache.noindex`，不随临时
DerivedData 清理。每次仍生成、编译、安装当前源码并运行设备流程；不会缓存
安装包、整个 DerivedData、模拟器、凭据或测试结果。

缓存 key 按 OS、CPU 架构、锁定工具版本、依赖锁文件、Mobile 原生配置和
patches 隔离；同工具链允许恢复较早的依赖缓存，再由 Gradle/Xcode 按实际输入
校验。修改 flows、runner 或工作流本身不会无端丢弃原生依赖缓存。仅在原生
构建完成后保存，即使后续设备测试失败也会保存；构建未完成不保存，避免把
不完整的首轮缓存固化。完全命中时不重复上传，避免每次提交新增大型归档。
`timings.json` 记录实际命令耗时；用恢复日志、编译器命中信息和前后耗时评估
收益，不能将“配置了缓存”等同于“已测得加速”。

缓存遵循 [GitHub 的分支作用域和容量回收规则](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)，
不会自动提高付费存储额度。PR 缓存只能由该 PR 后续运行复用；合并后的主分支
首次运行可能需要重新预热。Xcode 编译缓存使用
[Apple 的 Compilation Caching 设置](https://developer.apple.com/documentation/xcode/build-settings-reference)。
Android 使用软件图形渲染，macOS 关闭 Vulkan 以兼容本机 emulator；首次启动
最多等待 10 分钟。确认设备归本次运行所有后即采集失败日志，包括系统启动超时。
设备连接后持续保存 Android 日志，并保留完整退出前日志。Maestro 驱动启动上限
设置为 180 秒，页面断言仍使用各流程自己的超时；驱动超时继续使测试失败。
该设置见 [Maestro 官方连接超时说明](https://docs.maestro.dev/maestro-cli/run-your-first-test-with-the-maestro-cli)。

冷启动深链接在新 iOS Simulator 上可能出现“Open in Ray E2E”系统确认框。
flow 仅在 iOS 且该提示可见时点击 Open，然后继续验证真实登录页与邮箱参数。
`openLink.autoVerify` 只对 Android 有效，不能用于绕过 iOS 提示。参见
[Maestro 的平台差异说明](https://docs.maestro.dev/reference/commands-available/openlink)。

流程中的截图使用相对名称，由 Maestro 写入该流程 artifact 的 `takeScreenshot`
目录；不要传入指向报告目录其他位置的绝对路径，Maestro 会拒绝越出该目录。

报告目录为 `dist/test-results/mobile/e2e/<platform>/<run-id>/`，含构建日志、
JUnit、Maestro 诊断、截图、测试产物、bundle 页面检查、fixture 请求记录和 `run.json`。CI 应
始终上传报告。成功标准是原生构建、安装、非零流程、fixture 访问与清理均通过；
单独 YAML 语法检查或 JS export 不属于设备验收。

## 添加自己的流程

在 `apps/mobile/.maestro/` 增加 YAML。当前示例验证启动、页面往返和冷启动
深链接参数；选择器使用实际组件的 `testID`，不使用屏幕坐标。复用已有框架
页面，为新业务增加自己的数据准备与可观察断言。复杂准备逻辑放在 Node
编排或后端 fixture 中，不在 YAML 内实现业务逻辑。
替换框架起始页面时，同步更新 `.maestro` 流程与
`scripts/testing/mobile-bundle.mjs` 的必需页面清单，保留对实际测试页面的打包检查。

必须包含真正的失败断言；不要用 `optional: true` 掩盖核心路径失败。需要
第三方集成的专项测试单独显式启用，缺少前置条件时明确报告，不能悄悄当作通过。

当前实际平台结果见 [项目现状](status.md)。
