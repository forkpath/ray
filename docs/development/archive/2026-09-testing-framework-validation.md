# 框架测试实施验收记录

> 归档：本文是 2026-09 至 2026-10 的过程记录，保留历史失败、修复和证据路径，内容不再更新。
> 当前能力、已知限制和验收方式见 [项目现状](../status.md)。

本文记录实际执行结果，不能以配置文件存在代替运行验收。最终验收提交为 `3dd1b28cbbf269957144aa5ffd8b08191e3bd640`，阶段 0–4 已完成；详见文末 [Goal 结项复核](#goal-结项复核2026-09-29)。下文按阶段与运行轮次保留历史失败及修复过程，历史“待验证”不代表当前仍受阻。PR 尚未合并，没有发布应用或修改生产数据库。

## 阶段 1：单测入口与 Extension（2026-09-28）

交付 Mobile 的 Expo 57 / Jest 29 / RN Testing Library 14 入口，Extension 与 Web 的独立 Vitest 入口、测试类型检查，以及标准 Extension Playwright fixture。`test` 默认执行后退出；`extension:smoke` 保留，验证生产配置构建，`extension:e2e` 使用独立测试产物。

| 检查                   | 实际结果                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Mobile 单测            | 3 个文件、6 个用例通过：原生按钮、剪贴板正反结果、路由和深链接                                       |
| Extension 单测         | 3 个文件、9 个用例通过：消息、存储、错误边界                                                         |
| Web 单测               | 2 个文件、5 个用例通过：会话身份同步、定时器生命周期                                                 |
| 测试类型               | 三个 `typecheck-tests` 通过                                                                          |
| 应用类型               | 三个应用及 20 个依赖任务通过                                                                         |
| Lint                   | 三个应用通过，仍有原有警告；没有新增错误                                                             |
| Chromium Extension E2E | 7 个用例通过：五个页面与真实 background messaging、content script、storage                           |
| 干净安装               | 仓库外复制 1785 个源码文件，不复制 `.env` 或 `node_modules`；冻结锁文件安装通过                      |
| 干净副本单测           | 清除应用／服务环境变量后，三个 Nx 入口共 20 个用例通过，正常退出                                     |
| 负向单测验收           | 在独立副本破坏剪贴板状态、逐字显示、存储竞争保护；三组测试均检测到预期断言失败并退出 1，随后还原源码 |
| 负向 E2E 验收          | 故意破坏 content script 交互断言；退出 1，生成 trace／失败截图，临时浏览器 profile 全部清理          |
| 正式构建门禁           | 缺少站点/API URL 的正式扩展构建仍明确失败，不会沿用测试地址                                          |

执行入口：

```sh
pnpm nx run-many -t test,typecheck-tests -p mobile,web,extension --skipNxCache
pnpm nx run-many -t typecheck -p mobile,extension,web --skipNxCache
pnpm nx run-many -t lint -p mobile,web,extension --skipNxCache
pnpm nx run extension:e2e --skipNxCache
```

代码审查及修正：

- 扩展主题初始化读取存在竞争：晚到的旧值覆盖最新写入。现在监听变化后拒绝旧快照，卸载后不再更新，读取失败保留 fallback 并记录错误；有确定性的延迟读取回归用例。
- WXT 类型准备依赖部署 URL，导致新用户无 `.env` 时安装失败。仅 `prepare` 免除端点与权限推导，正式构建继续要求有效配置；独立副本验证了正反结果。
- 测试配置不启动 Web 生产构建插件，也不启动会读取环境文件的 WXT 测试插件；直接使用 WXT 官方 fake browser。路径映射复用项目 tsconfig，兼容当前 Vite 8 与 Vitest 4.0 的 Vite 7 类型边界。
- 扩展 fixture 在成功、失败、截图／trace 处理异常时均进入浏览器关闭与目录清理；测试产物不会进入 Git 或 ESLint 扫描。
- SettingsTile 增加原生按钮角色，交互测试同时验证可用与禁用状态。
- 一次并行高负载运行出现 Jest worker 退出提示；专项 `--detectOpenHandles --runInBand` 和干净副本复跑均正常结束，无遗留句柄报告。冷启动路由套件需要转换较多 Expo 模块。

边界：Mobile 的这些用例运行于 Jest，尚不是模拟器 E2E；Firefox 尚未执行真实扩展加载；签名、商店上传和 CI 分支规则不在本阶段通过范围。具体新增用例方式见 [测试指南](../testing.md)。

## 阶段 2：后端隔离环境与真实协议（本地与 Linux CI 已验收）

提供按套件裁剪的临时 Docker Compose 环境、唯一命名空间、迁移、报告与清理。Node 专用共享 fixture 位于 `libs/testing-server`，有真实 Engine/Pulse 消费者；Nx 边界和生产源码导入限制保持启用。

| 检查             | 实际结果                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Engine HTTP E2E  | 5 用例通过：完整启动、真实登录与角色、实际用户/组织计费路径、非法 DTO、领域错误映射                                                 |
| Engine 集成      | 2 用例通过：PG 身份与组织约束、真实 Redis Cache TTL/读写/删除                                                                       |
| Pulse ws E2E     | 7 用例通过：缺少身份、非法协议、组织授权、双实例 Redis 分发、drain、成员移除、撤销已连接会话                                        |
| Pulse Redis 集成 | 1 用例通过：真实 Redis 数据与过期                                                                                                   |
| Worker E2E       | 6 用例通过：完整模块启动、重复投递、真实 TTL 重试、最后一次失败/DLQ、活动租约重投、杀进程再重启恢复                                 |
| Worker PG 集成   | 1 用例通过：八个并发认领、租约恢复、旧处理者不能覆盖新状态                                                                          |
| 快速测试与类型   | Engine/Pulse/Worker 及 server-nest/server-redis 单测通过；三服务测试类型、应用类型和 lint 通过；隔离环境 guard 的 11 个正反用例通过 |
| 正式构建         | 三服务正式 Webpack 构建通过；Worker 子进程 fixture 使用相同编译器与解析机制                                                         |
| 中断清理         | 实际启动 PG 后向 runner 发送 SIGTERM，退出 1；报告 interrupted=true、cleaned=true，容器和网络删除                                   |
| 失败清理         | 协议、DTO、租约和子进程加载的真实失败均返回非零并保留报告，失败环境已清理                                                           |

阶段代码审查发现并修复：

- Engine 的 Zod 全局 pipe factory 原先返回类而非实例，非法请求进入业务层；真实 HTTP 用例先失败，修复后返回 400。
- 当前 Nest cache-manager 与 ESM Keyv 包装不兼容，完整服务不能启动；改用受支持的 Redis store adapter，真实 TTL/序列化断言通过。
- Pulse 对合法 JSON `null` 和畸形 Redis 消息处理不完整；增加协议 schema、Domain port/Application Use Case、持久会话和组织授权复查，清理订阅监听器与连接任务。
- Worker 将活动租约的重投直接 ack，可能丢失崩溃后的消息；改为确认延迟副本后 ack。认领次数约束状态写入，防止旧处理者覆盖新租约。真实进程恢复通过。
- 测试启动关闭 Nest/Vite/Nx/dotenv 的环境文件加载；fixture 写入前再次检查本机测试数据库命名。日志遮蔽认证请求头与 cookie；i18n 接受绝对目录，非开发环境不写类型文件。
- 测试子进程直接使用临时 TS loader 无法处理项目已有模块解析约定，改用正式 Webpack 编译器。测试入口不进入生产构建。
- 二次审查确认 `pg` 的连接字符串查询参数可以覆盖 URL 主机或端口。fixture guard 现在只接受带明确端口、无查询参数和片段的本机 runner 地址；11 个正反用例、类型检查与 lint 通过，避免表面为 loopback 的连接指向其他环境。

可追溯报告示例：Engine `caed68bcd05ff0e8`，Pulse `1ae62adb139b997b`，Worker `bad6f4253953fffd`，中断验证 `7e907b21869426b9`。报告位于 `dist/test-results/<project>/<suite>/<run-id>/`。新增计费路径用例首次因未启用组织计费返回 403；修正测试环境的显式功能开关后 5 项通过，没有改变生产默认配置。

边界：本地宿主为 macOS，基础设施运行于 Linux 容器；PR #1 运行 `36439125099` 的 Engine/Pulse/Worker job 已补齐 Linux GitHub Actions 通过记录。DLQ 用例从最后一次重试开始，未声称整条五次退避链已执行。测试缩短单条 fixture 的租约等待；生产五分钟租约保持不变。外部副作用仍需业务幂等键。

## 阶段 3：Mobile 设备入口（初期受阻记录，最终已通过）

已交付独立应用标识、内嵌 JS Release 构建、Maestro 两条流程、固定工具下载校验、
临时源码副本、专用模拟器与失败报告。YAML 语法检查通过；中断清理 helper 的
真实父进程/脱离进程组子进程测试通过，并确认不会停止不相关进程。

iOS 已实际完成 prebuild/Pods 并执行原生编译，报告 `ca7c6525e10142c1`。
本机 Xcode 26.3 在 Expo 57 的 `RuntimeScheduler.h` Swift ownership 注解处失败；
Expo 官方最低要求为 Xcode 26.4。现已固定 Xcode 26.6 / iOS 26.5，与 GitHub
macos-26 runner 对齐。重新运行前置检查报告 `963a1a8ab67c1621` 明确退出 1，
`cleaned=true`。本机未完成 iOS 安装或 Maestro 流程，不能计作通过。

Android 首次原生构建触及初始 45 分钟上限，报告 `dfe33d713db4c7e9` 为 `passed=false, cleaned=true`。第二次运行 `62e9104867b30faf` 进入 R8/原生 lint 后，2 GB 堆和 512 MB 元空间持续接近耗尽，诊断记录了 159 次 full GC、约 8.5 分钟 full GC 时间；主动中断后 `passed=false, cleaned=true, interrupted=true`，所属 Gradle/Kotlin 进程均退出。调整为 4 GB 堆、1 GB 元空间和 Gradle build cache 后，第三次 `e212791da4518c87` 原生编译成功（34 分 23 秒），但模拟器在 Vulkan 初始化时退出，整体仍为 `passed=false, cleaned=true`。

第三次 APK 的后续审查还发现内嵌 bundle 只有 Router 运行库，缺少应用页面。临时目录内的入口包装修复后，真实 `expo export:embed` 包含 6001 个模块、6008 个 sourcemap 来源，欢迎页、登录页和 fixture 地址均存在；这仍只是打包验证。现已增加原生 bundle 的页面完整性门禁，并按“bundle 检查 → 应用 APK”顺序构建。模拟器改为当前支持的软件图形模式，macOS 关闭 Vulkan，已越过此前退出点；独立启动诊断的 5 分钟不足，完整入口允许首次启动等待 10 分钟。

第四次 `1a1d4967f2b83604` 通过实际原生 bundle 门禁（5910 个 sourcemap 来源），bundle 构建 5 分 7 秒、应用 APK 构建 29 分 33 秒。APK 为 66,200,036 字节，SHA-256 `2cac0ff770862ae1c27a2291a8c9f0c5331fde5c70e867da32849b4e4643c3e3`。模拟器 514.8 秒完成启动，APK 及 Maestro driver APK 安装成功，但随后出现 `AndroidDriverTimeoutException`，没有执行页面断言，也没有 fixture 请求。整体 `passed=false, cleaned=true, interrupted=false`，不能计作 E2E 通过。

按 Maestro 官方指导设置 `MAESTRO_DRIVER_STARTUP_TIMEOUT=180000`，保留页面断言超时；新增设备连接后的持续日志，以及不截断的退出前日志。第五次 `abe5e01b7ab3ae6f` 完整入口耗时 38 分 54 秒后退出 1，`passed=false, cleaned=true, interrupted=false`。bundle 构建 5 分 21 秒，APK 构建 21 分 7 秒；最终 bundle 5909 个来源及必需页面检查通过。APK 为 66,197,800 字节，SHA-256 `b274c8aad25ce73e7d137b1da12269678dcb483b11dc69be5711b54c860a246c`。

第五次设备日志明确记录 `dev.mobile.maestro` 启动 ANR，Android 终止驱动后，Maestro 再次报告 `AndroidDriverTimeoutException`。ANR 主线程处于 DEX 解压/加载，调度统计显示约 4.1 秒 CPU 执行和 27.5 秒运行队列等待；模拟器当时 CPU 接近满载，宿主 `CPU_Speed_Limit=29`。这些证据说明本轮存在显著资源压力，但不能据此排除其他驱动问题。没有页面断言、JUnit 用例或 fixture 请求；临时目录及所属模拟器/进程均已清理，不能计作 E2E 通过。诊断保存在该报告的 `device-live.log`、`driver-anr-dropbox.txt`、`maestro-anr.log` 和 `host-thermal.txt`。

最终代码审查发现 `assembleRelease` 可能再次生成 bundle，因此在 APK 组装后增加相同页面清单的复查。该检查已针对第五次实际生成的最终 sourcemap 验证通过；这是组装结果检查，不改变上述设备失败结论。Android 需要在资源充足的环境继续验证，iOS 需要匹配的 Xcode/运行时；两个平台均不等于真机或商店包验收。

## 阶段 4：CI/CD 门禁（初期本地验收记录，最终远端已通过）

已增加 affected 选择、统一失败汇总、后端/扩展/Web/设备/Desktop job 和报告上传；
修复只覆盖 dev/main 而遗漏实际 arch 默认分支的问题。发布工作流复用同一 SHA
的完整 CI，扩展测试解压的待发布 ZIP，服务在推送前启动实际镜像，并核对镜像 ID。
部署后运行无业务写入的公开页面/HTTP/WS 探针。

本地已验证 25 项 CI 合约测试；涵盖套件选择、缺失/失败结果拒绝、真实网络探针
正反例、镜像替换/失败报告拒绝、进程树清理以及 Mobile bundle 页面缺失拒绝。发布命令负向演练返回非零，记录命令没有收到 push。actionlint 1.7.12 已检查工作流语法与引用。

独立副本的完整快速 CI 首次在 `email-server:test` 的无凭据导入用例触发默认 5 秒超时，另外两项邮件用例通过。该用例冷导入真实 React Email/模板/翻译模块；仅将这一导入用例的等待上限调整到 15 秒，保留全部断言。专项三项测试及 lint 通过后，完整矩阵复跑退出 0：47 个项目的 lint/typecheck/typecheck-tests/test/build 及依赖共 149 项任务成功，38 个单测入口共 319 个用例通过。其中 60 项任务复用此前成功缓存，复跑耗时 17 分 3 秒。首次被 `nxBail` 中止或未执行的任务未计作通过。原有 lint/依赖警告仍有保留，完整日志在 `dist/test-results/ci/local-20260928/full-fast-ci.log`；该记录不代替 Linux GitHub Actions 验收。

正式 Chrome ZIP 在无 `.env` 的独立副本构建，再解压运行 `extension:e2e-artifact`，7 项真实浏览器用例通过；ZIP SHA-256 为 `27b9bf4f83fa5d8f14cffdf4a8c001222fcdf4f09733b7e38adc6c7dd5e91b9e`。Mobile、Extension、Web E2E 的 lint/typecheck 及 21 个依赖任务全部通过。四个应用的 build/package 共 7 个任务也通过；Web 正式构建的 Chromium/Firefox/WebKit 三个页面用例通过。Desktop 在无环境文件的独立副本执行 28 个单测、正式构建、无签名打包和 Electron E2E，验证更新窗口、preload、路由重载、窗口 IPC 与断网后界面可用，3 个 Nx 任务通过；该记录仅覆盖本机 macOS x64，不代表 Windows、macOS ARM 或签名升级已经通过。

真实镜像构建发现 Nx 精简锁文件与复制进去的整个 workspace overrides 不一致，冻结安装失败。服务镜像改为安装 Nx 已解析的独立 runtime manifest/lockfile，保留冻结安装；修复后 Engine/Pulse/Worker 冻结安装与五个镜像构建全部通过。使用同一组镜像执行真实迁移、四个应用健康检查、公开 HTML、匿名会话、受保护 HTTP 401 和 WebSocket 4401 检查，报告 `25f061b7d09f6804` 为 `passed=true, cleaned=true, interrupted=false`，退出 0；容器与网络已删除。本地测试标签为 `5bbdf7160dc70287c10a84f3c62b39e8b63cd1bc`，实际验证对象由报告中的五个镜像 ID 标识；该记录不是远端同一提交发布门禁的验收。没有推送镜像或部署生产环境。

查询远端现有定时 CI 的失败日志，确认冻结安装失败于 Extension WXT prepare 的
Invalid URL；阶段 1 的无环境安装修复直接覆盖该原因。该旧运行不能代表新配置结果。

首次本地验收时，默认分支 arch 未受保护，私有仓库方案限制规则集。用户随后升级 GitHub Pro 并创建 PR #1；现在已核实 arch 和验收基线分支均要求 `Required checks`、严格同步基线并对管理员生效。已临时将 PR #1 从 draft 切到 ready：`Required checks=FAILURE` 时 GitHub 返回 `mergeStateStatus=BLOCKED`，随即恢复 draft，未执行合并。验证排除了 draft 本身造成的阻断，证据为 `dist/test-results/ci/pr1/required-check-merge-block.json`。

## PR #1 首轮远端验收（2026-09-29）

GitHub Actions 运行 `36439125099` 对应提交 `5723758f57160b9c1e2a87f3f72d83030be873f3`。完整快速检查/镜像验证、数据库契约、三个后端、Extension、Web、macOS ARM 和 Intel Desktop job 全部通过。已下载并核对后端 JUnit 与运行报告：Engine 5 E2E + 2 integration、Pulse 7 + 1、Worker 6 + 1；六份报告均 `passed=true`、`cleaned=true`、`interrupted=false`。`Required checks` 对四个失败项返回失败，没有静默跳过。

- Android：runner 注解报告磁盘耗尽，构建中途失去日志和 artifact，不能判断设备流程。仅在一次性 Ubuntu Android job 移除无关的预装 .NET/Haskell/CodeQL 工具，保留 Android、Java 与 Node 工具链，并记录清理前后磁盘空间。
- iOS：实际 `simctl` 输出为合法的 96,648 字节 JSON，但 runner 默认只返回末尾 64 KB，导致解析失败。该调用改为完整捕获；用远端真实清单驱动隔离 preflight 的回归实验，旧代码解析失败，修复后到达预期的运行时验证，仍不代表设备流程通过。
- Windows：ASAR 库按宿主分隔符解析路径，smoke 却将路径统一为 `/` 后直接传回读取 API。现在读取时恢复原生分隔符，依赖关系计算保持 POSIX；实际 ASAR 模块的 Windows 路径回归实验通过，完整 Windows 运行仍待复验。
- Storage：原 MinIO Docker Hub 镜像无法拉取，官方历史二进制地址也返回 410。测试改用 Coolify 维护者从相同上游版本构建的 GHCR 镜像，并锁定 OCI digest；这是一次性 S3 验收 fixture，不改变应用存储适配器或生产部署。镜像来源与构建方式见 https://github.com/coollabsio/minio 。真实发布契约仍需下一轮 CI 通过。

代码审查：此次修复保留原来的依赖完整性、设备流程、会话请求与发布顺序断言；Android 清理只发生在一次性 hosted runner，镜像锁定不可变 digest，两个脚本修复均已复现旧代码失败与新代码通过。未更改生产认证行为或降低合并门禁。

## PR #1 第二轮远端验收（2026-09-29）

运行 `36450023246` 的 PR head 为 `303cf51433486e234fc4e0c0cf6efc5a8a6095e4`。基础检查、发布镜像、三个后端、Web、Extension、macOS 两架构以及 Storage 已通过；Mobile 的两个失败见下文。Storage artifact 确认了回读、缓存头、不可变文件、先文件后清单以及中断发布五项契约。

Windows 的 E2E 与打包 smoke 通过，随后真实安装包的升级测试暴露了 URL 编码不一致：可信 URL 中的安装目录为 `RUNNER%7E1`，`loadFile` 实际加载的是 `RUNNER~1`。Windows 独立复现运行 `36452190503` 使用相同 Electron 39.2.7 与 ASAR 3.4.1，证实窗口与主 frame 身份一致，仅 URL 路径编码不同；改为 `loadURL(trustedUrl)` 后二者完全一致，`realpath` 不能解决此问题。

修复使用同一条 URL 加载页面和校验来源，保留窗口、主 frame、协议、host、origin、pathname、query 及导航限制。升级 E2E 的临时目录固定包含 `~`，让此行为持续进入回归验收。Desktop 的 lint、类型检查、构建与 28 项单测均通过。独立运行 `36452719302` 已通过真实 Windows 0.1.0 → 0.1.1 安装、重启与数据保留断言，`installed=true`；最后删除安装目录时出现 `EBUSY`，因此整个 job 仍失败。清理现使用有上限的删除重试，失败仍传播。临时诊断 workflow 不属于交付的 CI 配置。

iOS 在 Xcode 26.6 完成编译后，链接失败于菜单依赖 `react-native-ios-utilities@5.2.0` 的 `_OBJC_CLASS_$_RCTRootContentView`。采用上游 `dbc4ae1` 的同一 Swift 修复，通过 pnpm patch 固定；GitHub 虽有 5.2.1 tag，当时 npm 仍返回 404。来源及移除条件见 [补丁说明](../../../patches/README.md)。冻结安装通过；Mobile lint、两类类型检查及 6 项单测通过；三个服务重新构建和 runtime 锁文件裁剪通过，没有把 Native 补丁引入后端 runtime。

Android 报告 `e40819b5ca89af69` 的 Release APK 和最终 bundle 页面检查通过（5909 个来源），随后模拟器因只余 4021.59 MB、默认数据分区要求 7372.80 MB 而退出；报告为 `passed=false, cleaned=true`。修复在 APK 和报告保存后删除本次临时原生编译目录，并把专用测试设备的数据分区固定为 2 GB；不触碰已有模拟器或工作区原生工程。

本次审查同步把补丁纳入 Nx 缓存输入与完整 CI 选择，并让 migrator 镜像带上 pnpm 配置引用的补丁文件。25 项 CI 合约测试通过，包括仅修改补丁也不能遗漏设备测试的回归检查。修正六个 App/服务 README 的过时测试入口说明，保持测试框架、设备流程和真实业务验收的区别。

## PR #1 第三轮与定向回归（2026-09-29）

PR head `0ffeefe578fa4c846535e92a5192edebb798c53e` 的运行 `36455829977`
已通过公共快速检查、五个实际镜像、Web、Extension、Engine、Pulse、Storage
及 macOS 两架构。Worker 暴露了真实消息时序缺陷：同一延迟队列混放消息 TTL，
30 秒租约副本阻塞其后 4–6 秒的处理失败重试，触发原有 15 秒断言超时。

增加明确排列长租约与短重试的回归后，旧实现的独立运行 `36456929764`
按预期失败。修复按固定 TTL 队列分档并向上取整，保留确认后 ack、持久化、
去重、五分钟租约、认领 fencing 和五次尝试上限，不删除旧队列消息。
独立运行 `36457847442` 的 Worker 6 项真实 RabbitMQ E2E 和 1 项数据库
集成测试全部通过；报告 `b2b644fbfd372c70`、`f2a21378e394501c` 均为
`passed=true, cleaned=true, interrupted=false`。本地相关单测、两类类型检查
和 lint 共 13 项 Nx 任务通过；回归断言仍要求短重试在 15 秒内完成。

iOS 独立运行 `36454765891` 已越过原来的 Swift 链接失败，随后 Sentry 的
Xcode 调试符号脚本因 pnpm 隔离安装而找不到 `@sentry/cli/package.json`。
Mobile 显式声明已有锁定版本 `@sentry/cli@2.58.4`，冻结安装通过，本地执行
真实脚本确认关闭上传时正常退出；未启用上传或引入凭据。完整设备结果仍待确认。

Windows 增加删除重试仍出现 `EBUSY`，因此继续按本次随机安装目录的唯一后缀
定位、停止并等待测试进程，兼容 Windows 长短路径。进程清理和目录删除失败
仍使任务失败；只有全部清理成功才写入 `cleanup.json`。完整 Windows 修复
的独立运行 `36457847442` 已确认匹配并停止测试进程、删除目录，报告
`cleanup.json` 为 `cleaned=true`。该次流程仍因 PowerShell 将已处理的子进程
退出竞争留作失败状态而中止。脚本在所有停止与等待检查通过后明确返回 0，
未处理异常仍立即失败；完整流程由 `36459752396` 继续复验。

Android 第三轮报告 `23bae139f566e49f` 的 APK 与 bundle 复查通过，删除本次
原生编译目录后仍只余 5050.49 MB。Emulator 37.1.11 实际采用至少 6 GB
userdata 分区，并要求 7372.80 MB 可用空间，2 GB 配置未生效；因此撤掉该配置。
Ubuntu runner 的预装 NDK 27.3/28.2/29.0 均不是本项目需要的版本，CI 现在
清理这些一次性 runner 上的未用目录，保留并安装锁定的 27.1.12297006。
SDK 路径须匹配 hosted runner 的固定位置；本地 SDK 不做这项清理。
参考 [GitHub runner 清单](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
及 [Emulator 的分区空间检查](https://android.googlesource.com/platform/external/qemu/+/refs/heads/emu-32-release/android-qemu2-glue/main.cpp)。

## PR #1 第四轮远端验收（2026-09-29）

运行 `36460925910` 对应提交 `0c3841f`。完整快速检查与真实镜像验证、
数据库契约、Engine/Pulse/Worker、Web、Extension、Storage 和桌面三个平台
均已通过。后端 22 个真实协议及集成用例通过，六份报告均为
`passed=true, cleaned=true, interrupted=false`；发布镜像报告
`a423182aba0b572e` 也满足相同条件。

Windows 完整独立运行 `36459752396` 以及本轮 PR job 均已通过真实
0.1.0 → 0.1.1 安装升级、重新启动、版本与 userData 保留检查，
`installed=true`，`cleanup.json` 为 `cleaned=true`。进一步审查发现测试
安装默认会使用正式应用的 `Ray.lnk`；测试 profile 现在关闭桌面/开始菜单
快捷方式创建，并采用独立名称，避免 NSIS 启动已有正式快捷方式。
独立运行 `36464075702` 的安装升级与清理通过，预先放置的桌面和开始菜单
`Ray.lnk` 哨兵内容在安装后均保持不变。

Android 的磁盘修复已越过模拟器创建：报告 `df0db157055391d2` 完成
Release APK、安装、启动、欢迎页与冷深链接参数断言，并产生真实 session
fixture 请求。两条流程仍在截图步骤失败，因为绝对路径落在 Maestro 2.10
管理的单流程截图目录之外；导航后续步骤尚未运行。现在使用相对截图名称，
由 Maestro 放入各流程的 `takeScreenshot` 目录，保留所有断言与截图。
该次报告仍为 `passed=false, cleaned=true, interrupted=false`。
参见 [Maestro 截图路径契约](https://docs.maestro.dev/api-reference/commands/takescreenshot)。

iOS 独立运行 `36457847442` 的原生编译和安装成功，但真实 SecureStore
因缺少 Keychain entitlement 导致启动崩溃。对旧包补签的诊断运行
`36463583037` 又被系统拒绝启动，未作为交付方案。测试构建现在保留 Xcode
自身的模拟器签名流程，使用本地 ad-hoc identity 和空 Development Team，
由 Xcode 在链接阶段生成模拟器 entitlements；不再关闭代码签名，也不在
产物上自行注入权限。不需要 Apple 证书，不替换 SecureStore、不绕过认证。

## 额度恢复与原生缓存验收（2026-09-29）

提交 `cd87e3c` 的运行 `36549667497` 已正常启动，原来的账单限制解除。
全仓快速检查、五个实际发布镜像、数据库契约、Web、Extension、后端三个
服务、Storage 和桌面三个平台全部通过。后端 22 个用例无失败或跳过，
六份报告均 `passed=true, cleaned=true, interrupted=false`；镜像报告
`c1d2747aa454c493` 也通过并完成清理。Windows 报告再次确认
`installed=true`、`cleaned=true`。

新增缓存独立于设备验收：Android 保存 Gradle wrapper、依赖和 build cache；
iOS 保存 CocoaPods 下载及 Xcode 内容寻址编译缓存。缓存按平台、架构、
工具链和原生依赖输入隔离，只有原生构建完成才保存，之后设备失败仍保存。
清理了本次任务旧诊断及已替换依赖版本的七份远端缓存，释放约 6.74 GB，
没有增加付费存储额度。两端每次都构建当前源码并重新运行真实设备流程。

本轮 iOS 报告 `ca8819108b00b5b3` 完成构建、安装、欢迎页及完整页面往返，
真实 SecureStore 启动不再崩溃。Xcode 编译耗时 845.373 秒，首次内容缓存
记录 1,937 次 miss、0 次 hit；668,918,128 字节归档在设备失败后仍成功保存。
计数按独立的 `Cache miss` 行计算；此前 3,874 为同一结果两种日志重复计数。
这证明缓存上传生效，尚不能作为恢复命中或提速证据。

剩余冷深链接用例被新模拟器的“Open in Ray E2E”系统确认框阻挡，失败截图
及 UI 层级确认了该提示。flow 现在仅在 iOS 且提示可见时点击 Open，再执行
原来的登录页和邮箱参数断言。符合
[Maestro 的 iOS 深链接行为说明](https://docs.maestro.dev/reference/commands-available/openlink)。
本轮 iOS 为 1/2 流程通过，清理成功。独立运行 `36553220717` 复用本轮
原始签名安装包，在全新模拟器运行修正后的两条 flow，2/2 通过、无跳过，
fixture 访问与清理成功。整个 job 耗时 3 分 8 秒，没有再次原生编译或修改
安装包；该证据确认系统提示修复，最终仍要求 PR 完整矩阵通过。

Android 本轮报告 `ace56130fc984a0f` 完整通过：重新构建的 Release APK、
页面往返、冷启动深链接参数、fixture 访问和清理均通过。设备入口耗时
40 分 49 秒，其中从原生项目准备完成到 APK 完成约 36 分 19 秒。
Gradle 缓存归档 2,315,761,428 字节，上传步骤耗时 48 秒。

## Goal 结项复核（2026-09-29）

结论：原实施方案阶段 0–4 的实现、阶段代码自审及框架范围内的整体验收均已完成。
原先的远端 CI、设备验收和合并保护三项阻碍已解除。此前文档在最后一次 CI
完成前写入的“待验收”状态遗漏更新，本次已校正；历史失败记录仍保留。

本次复核将方案的完成依据与审核记录、当前源码、Nx 解析后的测试入口、
GitHub 实时检查结果和已下载的 JUnit/清理报告逐项对应。源码复核重点为
工具版本来源、套件选择、必需检查失败传播、原生缓存与设备结果隔离、
模拟器流程断言、资源清理及发布前产物绑定。没有发现阻碍本方案结项的
未关闭问题。此结论不表示对未来所有框架能力提供零缺陷保证。

| 阶段                | 实现与审核结论                                                                                   | 验收依据                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 0：版本修正         | 已完成；复核 deploy/release-extension 的 pnpm setup，版本统一由根 packageManager 决定            | 固定 Node、冻结安装及 workflow 检查通过，无旧 pnpm 独立覆盖                                            |
| 1：单测与 Extension | 已完成；存储初始化竞争、环境配置隔离、fixture 关闭及清理问题已审核修正                           | 干净安装、20 个 Mobile/Extension/Web 单测、负向断言验证及 7 个 Chromium 扩展 E2E 通过                  |
| 2：后端集成         | 已完成；DTO 校验、Redis store、Pulse 授权、Worker 租约/fencing/重试及数据库隔离 guard 已审核修正 | 本地与 Linux CI 均通过；当前提交 22 个真实协议/集成用例通过，六份报告清理成功                          |
| 3：Mobile           | 已完成；最终 bundle 页面门禁、模拟器签名、深链接提示、进程清理与缓存边界已审核修正               | 当前提交 Android/iOS 各 2 个模拟器 E2E 通过，无失败或跳过，两端报告 cleaned=true、interrupted=false    |
| 4：CI/CD 与指南     | 已完成；affected 选择、缺失/失败检查拒绝、同一 SHA/产物绑定及失败不发布已复核                    | 当前提交 15/15 检查成功；25 项 CI 合约测试、真实镜像探针、Windows 升级、分支保护及失败合并阻断证据齐全 |

这里的阶段审核指实施过程中执行的代码自审、问题修正与回归验证；本次又复核了
这些记录和关键路径。GitHub PR #1 当前没有第三方提交的正式 Review，不将
自动 CI 或本次自审描述成独立审阅者的批准。原方案没有把第三方批准设为完成条件。

最终验收对象是提交 `3dd1b28cbbf269957144aa5ffd8b08191e3bd640`，
[运行 36554712030](https://github.com/forkpath/postfly.io/actions/runs/36554712030)
的 15 项检查全部成功，包括 `Required checks`。重要产物如下：

- Android：`c71526dede578d29`，2/2 用例通过、清理成功。
- iOS：`36b18a336b6e04d4`，2/2 用例通过、清理成功。
- Engine：`ce07d35709d11b3a` / `7c2f59e156a217b1`，5 + 2 用例通过。
- Pulse：`f4e4f1c0b5ed5af3` / `e2d6e1b6ef830629`，7 + 1 用例通过。
- Worker：`aa72f4f747f76774` / `38873496c4df70ba`，6 + 1 用例通过。
- 实际发布镜像：`a4759c42479042c6`，通过、未中断且清理成功。
- Web 3 个页面用例、Extension 7 个用例、桌面三个平台各 28 个单测通过；
  Windows 实际安装升级 `installed=true`，三个桌面平台清理均成功。

再次读取 GitHub 分支保护：`arch` 与 `codex/testing-baseline-20260928`
均要求 `Required checks`，`strict=true`、`enforce_admins=true`。
失败时临时转为非草稿仍被阻止合并的历史证据已核对，当前 PR 为 draft、
未合并且 `mergeable_state=clean`。

两端缓存均已实际恢复命中。Android 两个 Gradle 构建命令合计从 2,178,210 ms
降至 930,892 ms，494 个 task 为 `FROM-CACHE`；iOS xcodebuild 从
845,373 ms 降至 767,620 ms，824 hit / 1,113 miss。两轮实测分别减少
约 57.3% 和 9.2% 的构建耗时，不包含缓存恢复或设备执行，不保证每轮相同幅度。

本次复核只读取已有远端结果并补正文档，没有重新触发高成本原生 CI。
本地汇总证据保存在 `dist/test-results/ci/pr1/final-validation.json`，
原始 artifacts 位于 `dist/test-results/ci/github-36554712030/artifacts/`。

## 当前验收边界

- 本次完成的是框架实现、测试体系、CI/CD 门禁和约定的模拟器/隔离环境验收。
  PR 合并、生产部署、真实 registry 发布不是已执行事项。
- iOS 通过的是托管 Xcode 26.6 环境；本机 Xcode 26.3 的工具链限制仍存在，
  不再阻碍本方案要求的 iOS 模拟器验收。
- macOS Developer ID 签名安装升级、真机硬件、商店包及发布、真实第三方账户
  属于原方案明确区分的专项验收，尚未通过，不包含在默认无生产凭据测试中。
- Firefox 扩展目前仅完成构建验证，真实加载和行为验收仍为单独项目；
  Web 的 Firefox 页面 smoke 不能作为 Firefox 扩展通过的依据。
