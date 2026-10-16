# 依赖维护与安全检查

依赖版本以根 `pnpm-lock.yaml` 为准，使用 `packageManager` 指定的 pnpm。
应用自己直接导入的包应在该应用的 manifest 中声明；跨应用共享的版本放在
`pnpm-workspace.yaml` 的 catalog 中。根 manifest 仍为没有独立 package 的
Web、后端和共享库提供依赖，不能因为 Mobile 也使用某个包就从根删除它。

## 分组更新

`.github/dependabot.yml` 每周检查 pnpm 和 GitHub Actions，Nx、Expo/React Native、
Better Auth、Prisma 按关联工具链分组，其他依赖的 minor/patch 更新分为开发和运行时组。
所有更新通过 PR 审核，不自动合并。Nx 升级需要检查迁移，Expo 更新需要验证完整
SDK 配套版本；分组本身不能证明版本兼容。

配置不指定 `target-branch`，以便安全更新使用默认分支配置。默认开发分支采用 `dev`，
实际远端切换记录见优化计划。pnpm 的根锁文件覆盖 Mobile、Extension 和 tools 的
workspace importer，不另外维护应用锁文件。

公共 npm 依赖使用 Dependabot 默认的 npmjs.org 源，不在 `registries` 中声明无认证的
`npm-registry`。该字段用于配置额外 registry 的访问凭据；把公共源仅填写为 `type`、
`url` 和 `replaces-base` 会被 GitHub 的配置校验拒绝。以后接入私有源时，再按
[官方认证配置](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#type-and-authentication-details)
添加对应的 Dependabot secret。

npm/pnpm 的版本检查安排在每周一北京时间 03:00，GitHub Actions 每周一检查；
分别最多保留 5 个和 2 个版本更新 PR。安全更新需在仓库设置中启用，且上游必须已有
可用的修复版本。Dependabot 创建升级 PR 后仍须通过本仓 CI 和人工审核，不自动合并，
也不能保证尚未发布修复的漏洞立即消失。

修改配置后，应检查 GitHub 原生 `.github/dependabot.yml` 校验结果。普通 YAML 解析、
Actions 工作流检查和 `Dependency security` 扫描都不能替代这个校验：后者检查现有
锁文件中的漏洞，不验证 Dependabot 是否能够解析配置或生成升级 PR。

## 官方源扫描

`Dependency security` 可复用工作流由每次 PR/dev CI 调用，也可每周定时及手动运行：

```sh
pnpm audit --registry=https://registry.npmjs.org --audit-level=high --json
```

检查根锁文件，无需安装依赖，也不执行依赖的生命周期脚本。原始命令遇到高危或严重
告警返回非零。CI 使用 `node scripts/ci/audit-dependencies.mjs` 保留原始报告，并独立
核验下述有期限的本地补丁记录；没有匹配且有效的修复证据时，高危或严重告警阻止 CI。
网络、registry、报告结构错误也按失败处理。原始报告及 `*-evaluation.json` 一并上传为
`dependency-audit`，保留 7 天，不能把评估通过描述成原始扫描归零。
其成功结果是 `Required checks` 的必需前置条件，dev/main 的合并保护要求该汇总检查。
main 推广时另做一次相同扫描和补丁核验，拒绝在 staging 验收之后新披露的 high/critical 告警。
安全检查通过后才启动测试选择、依赖安装和设备矩阵，避免已知失败消耗原生构建额度。

处理告警时先检查实际依赖路径、受影响版本和调用方式，优先升级直接依赖与对应工具链。
传递依赖 override 必须限定版本范围并通过相关构建和测试。不要自动执行 audit fix、
忽略全部未修复告警，或把扫描失败写成扫描通过。

## 2026-09-30 修复前基线

- 不安装任何依赖的干净目录扫描已复现：退出 1，且没有生成 `node_modules`。
  报告统计为 low 29、moderate 144、high 158、critical 8；这些是扫描器统计，
  不能等同于相同数量的可利用应用漏洞。46 个依赖包涉及 high/critical 告警。
- 清单及来源保存在 `dist/test-results/hardening-20260930/audit-remediation-inventory.json`。
  当时依赖修复、复扫及远端必需检查尚未完成；此记录保留修复前的失败证据。
- AST 导入检查发现 Mobile 未显式声明其直接使用的 `dayjs`；Extension 的
  Playwright、Vitest、React Testing Library 当时仍依赖根工具安装；下述修复已补齐项目声明，
  并复查共享 catalog 和冻结安装，没有为缩小根 manifest 而破坏共享库解析。

选项依据：[Dependabot 官方参考](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)、
[pnpm audit](https://pnpm.io/10.x/cli/audit)。

## 安全修复实施（2026-09-30）

修复前官方源复扫为 low 29、moderate 155、high 169、critical 9，涉及
47 个不同 high/critical 包。扫描包含开发工具链；这些数字不代表可利用的运行时漏洞数。
原始报告保留为 `dist/test-results/hardening-20260930/dependency-audit-current.json`。

- 认证 CLI 从已弃用的 `@better-auth/cli@1.4.21` 切换到官方 `auth@1.6.26`，
  与现有运行时同版；schema 门禁仍只生成临时候选，不能覆盖受控模型。
- Vitest、UI 和 V8 coverage 固定为同一 `4.1.11`，版本放在共享 catalog。
- Electron 固定为 `41.10.7`，打包配置直接读取 manifest 的固定版本。
  该版本使用维护中的 `@electron-internal/extract-zip`，移除无修复版本的旧 extract-zip 路径。
  本轮选择修复已知告警的较小主版本跨度，不能把这当作后续持续支持期限的承诺。
- Nest 核心、测试与 HTTP/WS adapters 对齐 `11.2.6`；Axios、Lodash、WS 保持当前主版本升级。
- Mobile 直接声明 dayjs；Extension 直接声明 Playwright、Vitest、React Testing Library。
  共享版本集中在 catalog，根依赖继续服务于共享库，原生 SDK 与 React 固定版本保持不变。

`pnpm-workspace.yaml` 中的安全 overrides 仅匹配受影响版本区间，修复后的新版本不被
降级。补丁来源是官方源扫描返回的 GHSA 修复范围及 npm 发布元数据；没有使用 audit
忽略名单。brace-expansion、minimatch、js-yaml、picomatch 和 svgo 分别保持各自主版本。
不应把这些安全下限改成无范围的永久统一版本。

三个需要额外兼容性确认的范围为：Prisma 7.8 配置使用的 deepmerge-ts 7 → 8；
构建工具的 serialize-javascript 6 → 7；Firefox profile 使用的 adm-zip 0.5 → 0.6。
前两者保留其调用方使用的 CommonJS/import 导出，Node 24 满足引擎要求。
已验证调用方实际解析到的版本、深合并与输入不变、函数/正则序列化及归档往返，
同时完成真实 Prisma 迁移/schema、Web/Extension 构建与 Firefox 打包。

本地验证结果如下；移动 JS 导出与真实原生设备 CI 分开报告。
最终提交的远端矩阵仍需集中执行，旧提交的 CI 不能替代本轮依赖升级验收。

| 验证                   | 本地结果                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| 无应用 `.env` 冻结安装 | 无 `.env`/`node_modules` 的源码副本通过；pnpm 用时 2 分 53 秒，复用本机下载缓存                               |
| 官方源安全复扫         | 退出 0：high 0、critical 0；保留 low 12、moderate 58，未配置忽略名单                                          |
| 全仓单测与覆盖率       | 40 个项目通过；38 个 Vitest 门槛保持原值，另含 Mobile Jest 与生成器 Node 测试                                 |
| 类型与零警告 lint      | 48 项目共 106 个任务通过；兼容性修复后另有 29 项相关任务通过                                                  |
| 后端真实集成/E2E       | Engine/Pulse/Worker 六套共 28 项通过；本次容器、网络、卷全部清理                                              |
| Web marketing          | Chromium、Firefox、WebKit 三个真实生产页面流程通过，无重试                                                    |
| Extension              | Chromium 真实扩展 7 项通过，Firefox 产物打包通过                                                              |
| Desktop                | Electron 41.10.7 macOS x64 打包 UI、仓外 smoke、更新故障及下载流程通过                                        |
| Mobile                 | iOS/Android Hermes 与 Web 导出通过，8 分 54 秒；不等于原生构建或设备验收                                      |
| Auth schema 与 CI 合约 | 新 CLI schema 与受控模型一致；36 项 CI 行为合约通过                                                           |
| 生成器实际验收         | 临时副本生成个人/组织资源、拒绝重复写入、类型/lint/覆盖率与真实 HTTP/PostgreSQL 通过；10 项 HTTP 测试，无失败 |
| 项目依赖归属           | AST 检查 Mobile 141 文件/48 个包、Extension 52 文件/17 个包，无缺失直接声明                                   |

原始日志与报告位于 `dist/test-results/hardening-20260930/dependency-*`，后端逐套报告
及清理核验汇总为 `dependency-backend-acceptance.json`。生成器复验报告为
`dist/test-results/ray-plugin/2026-09-30T06-25-30.952Z/acceptance.json`，
`passed=true, cleaned=true`；其容器、网络与卷另外核验无残留。本地桌面测试使用隔离认证与
mock Keychain；未验证签名安装、真实钥匙串迁移或 Windows 更新重启。移动设备、
其他桌面平台与最终同一提交远端门禁保持未完成状态。

### 升级时发现的兼容性问题

- Vitest 4.1 使用工作区的 Vite 8。Extension 的 JSX 配置改为 Oxc 的自动 runtime；
  38 个受控源码文件均保留在覆盖率报告中，未通过排除 TSX 绕过失败。
- 后端套件已经由 SWC 处理 TypeScript 与 Nest 装饰器元数据，因此显式关闭第二次
  Oxc 转换。实际转换复现了派生类成员赋值被移到 `super()` 之前的问题；修复后
  Engine 的生产模块装配、真实 HTTP 与仓储集成测试通过，不修改认证模块来规避编译问题。
- Worker 单测显式替换数据库注入 token，继续使用已有内存 Inbox；真实持久化与
  broker 行为仍由独立集成/E2E 验证。新转换器保留 DI 元数据时不会意外初始化开发数据库。
- Electron 的首次本地 UI 验收超时。进程采样显示主线程等待 macOS Keychain，
  与未签名测试包读取已有钥匙串项有关。临时测试启动入口使用 mock Keychain 后，
  相同 Electron 版本的实际包和 UI 验收通过；正式应用配置与安全 Fuse 保持原值。
  同时修复启动失败时遗漏删除临时 profile 的清理边界。该验收不包含真实钥匙串兼容性，
  详见 [桌面测试边界](../../apps/desktop/README.md#测试)。

参考：[官方 CLI](https://better-auth.com/docs/concepts/cli)、
[Electron 41.10.7](https://github.com/electron/electron/releases/tag/v41.10.7)、
[extract-zip 告警](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)、
[deepmerge-ts 告警](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)、
[Vite Oxc 配置](https://vite.dev/config/shared-options#oxc)、
[Electron 测试钥匙串隔离](https://releases.electronjs.org/pr/53790)。

## 2026-10-01 扫描增量

恢复远端 CI 后，官方源报告 Nx 23.2.1 固定的 Axios 1.18.1 命中 7 条 high 告警，
包括 [data URI 解析拒绝服务](https://github.com/advisories/GHSA-c29m-xwm3-cm6r)。
应用的 Axios catalog 已使用修复版 1.20.0，本次只覆盖 `nx@23.2.1>axios` 为 1.20.0。
升级 Nx 时应重新核对其依赖并移除不再需要的精确版本 override。

锁文件仅替换这条依赖路径，其他包的版本和 peer 解析保持原样。冻结离线安装通过，
官方源复扫退出 0，high/critical 均为 0，另有 low 12、moderate 59。
实际 Nx HTTP client 的本地 GET、重定向、JSON POST 与 503 拒绝行为通过；
最终远端检查以修复提交的 CI 为准，没有增加忽略规则或降低扫描门槛。

## 2026-10-02 扫描增量

文档 PR 的新扫描发现 `@swc/cli@0.8.1 > piscina@4.9.3` 命中 Critical
[GHSA-67c8-pqhq-4rmx](https://github.com/advisories/GHSA-67c8-pqhq-4rmx)。公告于
2026-10-01 纳入 GitHub Advisory Database，修复版本包括 4.9.4；旧的成功扫描不能
代替推广时的安全复扫。这是构建依赖告警，不是已发现服务器遭利用的证据。

将现有 Piscina 4.x 安全下限从 4.9.3 提升到 4.9.4，仍满足 SWC CLI 的 `^4.3.1`。
锁文件只变更该包的版本、完整性校验、SWC 引用及 override，保留其他依赖和 peer 解析。
冻结安装通过；官方源复扫退出 0，high/critical 均为 0，另有 low 12、moderate 59。

隔离 Worker 探针复现旧版接受原型继承的环境选项；同一断言在新版通过，同时验证显式
环境配置与正常并行任务。真实 SWC CLI 使用两个 Worker 编译 TypeScript，生成结果可执行；
Engine、Pulse、Worker 的 Nx 生产构建全部通过，未命中构建缓存。
没有添加 audit 忽略规则，也未降低测试选择或安全门槛；远端完整检查以新提交为准。

参考：[Piscina 4.9.4](https://github.com/piscinajs/piscina/releases/tag/v4.9.4)。

### node-forge：有期限的本地安全补丁

PR #6 的完整 CI（含 Android/iOS）通过后，dev 合并提交 `7efebd8` 的新扫描发现
[GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv)。公告在
2026-10-01 更新，涉及 `expo > @expo/cli > node-forge@1.4.0` 的 RSA PKCS#1 v1.5
验签：嵌套 DigestAlgorithm 可带多余元素。核查时 npm 尚无修复版；
[上游 PR #1152](https://github.com/digitalbazaar/forge/pull/1152) 尚未合并或发布。

本仓通过 pnpm `patchedDependencies` 应用同样的嵌套元素数量检查，补丁位于
`patches/node-forge@1.4.0.patch`。这是仓库维护的临时修复，不是上游正式安全版本。
Expo CLI 直接调用点是本机 iOS 签名证书元数据解析；锁文件还含 Expo 更新签名工具与
Android adbkit 的同版本引用，三条引用都应用该补丁。没有据此推断服务器已遭利用。

- 对原始包运行同一组 9 项回归：3 项异常签名断言失败、6 项正常行为通过；补丁后全通过。
  覆盖含/不含 NULL 参数的有效 SHA-256、3 种额外嵌套元素、错误消息、RSA-PSS、证书解析，
  以及 Expo 实际适配器读取模拟证书。适配器测试不访问真实钥匙串，也不代表正式签名验收。
  另补 Expo 更新签名工具的真实 API 测试，验证其解析到同一补丁实例、证书/CSR 验证和
  签名往返；签名同时由 Node 标准库独立校验，共 10 项本地测试通过。
- 冻结安装通过，锁文件只增加补丁标识与对应引用；保留包名、版本和 registry 完整性记录。
- 原始扫描仍为 low 12、moderate 59、**high 1、critical 0**；独立评估为本地缓解 1、
  未缓解 0。不得使用 `--ignore-unfixable`、修改包版本伪装成修复版或隐去原始报告。
- `.github/security-mitigations.json` 精确绑定 GHSA、包/版本、全部依赖路径、严重性、
  公告更新时间和受影响/已修复范围，以及补丁、冻结锁文件、workspace 配置和回归测试的
  SHA-256。缺文件、哈希变化、新增路径、新告警、公告更新或报告不一致均失败。
- 本次记录有效期为 2026-10-02 至 **2026-10-16 00:00 UTC**（北京时间 08:00），
  不自动续期。修改依赖也会要求重新审查该记录，不能仅为恢复绿色自动重算哈希。
- 上游发布修复版后，升级、移除补丁与此记录、重新冻结安装，运行回归、原始扫描和完整
  原生 CI；此前需要续期时，先重新检查公告、代码与复现，再经 PR 审核。

评估器另有失败场景测试：未知 high/critical、失效或改动的补丁、改变的依赖/测试输入、
异常扫描退出码、无效 JSON、缺失 findings 和过期记录均拒绝放行。两环境使用同一评估器；
`Required checks` 仍要求安装后的回归和全部选中测试通过，production 仍只接收同 SHA 的
成功 staging 记录与五个不可变镜像摘要。本地通过不代替远端原生与部署验收。

## 2026-10-03：HTTP 缓存与模式解析补丁

PR #12 初次运行仍被两项新披露的 High 告警阻断；修正 Dependabot 公共 registry
配置只解决配置校验，不会修复已锁定依赖中的漏洞。核查 npm 时，
`http-cache-semantics@4.2.0`、`braces@3.0.3` 和 `node-forge@1.4.0` 均无正式修复版本。
前两项因此采用有期限的 pnpm 本地补丁，不伪造包版本或降低安全门槛。

| 包                         | 告警与锁文件调用路径                                                                                                                   | 本地修复                                                                                             |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| http-cache-semantics 4.2.0 | [GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)；SWC CLI → bin-wrapper → downloader → got → cacheable-request | 在处理 `max-stale` 或异步重新验证前检查响应复用限制，防止共享 Cookie、private、no-cache 等限制被绕过 |
| braces 3.0.3               | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)；Nx ESLint/Jest → Jest transform → micromatch                 | 解析器与 compile/expand/stringify 的 AST 遍历均限制嵌套深度为 100；调用者可降低，不能提高安全上限    |

运行时代码取自已审查的上游修复提案：
[http-cache-semantics PR #58](https://github.com/kornelski/http-cache-semantics/pull/58)，
提交 `14a8c2ad51740dc39bf3e8f1a11c845a5003f217`；
[braces PR #72](https://github.com/micromatch/braces/pull/72)，
提交 `d0d575e55e74a4e0218e5248fafb79efc3e54ebb`。核查时均未合并、未发布；
这是仓库维护的临时修复，不等于上游正式安全版本。锁文件中的两个 cacheable-request
版本及 micromatch/chokidar 的引用均应用补丁，原始 registry 完整性记录保留。

验证命令：

```sh
pnpm install --frozen-lockfile
pnpm ci:checks
node scripts/ci/audit-dependencies.mjs dependency-audit.json
pnpm nx run-many -t test -p mobile,ray-plugin --nxBail
pnpm nx run-many -t build -p engine,pulse,worker --nxBail
```

- 同一组 23 项新回归在原始依赖上为 6 通过、17 失败；补丁后 23 项全部通过。
  覆盖序列化缓存、共享 Cookie、认证请求、请求/响应缓存指令、正常过期复用、304 验证，
  以及通过实际 SWC downloader 的 got 客户端访问本机 HTTP 服务的两个用户隔离测试。
- braces 测试覆盖低于原有字符数上限的深层输入、调用者直接传入的 AST、100 层边界、
  禁止提高上限、正常范围/备选/转义模式及 Jest 实际 micromatch 调用方。
  超过新上限会抛出明确的深度错误；外部应用若接受不可信模式，仍需处理输入错误。
- 原有 node-forge 公告与上游补丁重新核查，10 项真实签名与 Expo 适配器回归通过。
  它的实现不变，因 workspace/锁文件变化重新绑定审查哈希，原有到期时间不延长。
- 三条审查记录均在 **2026-10-16 00:00 UTC** 到期。评估器分别绑定每个 GHSA、
  包/版本及其对应补丁和回归测试，其他包或其他告警不能借用这些文件放行。
  原始扫描仍为 **high 3、critical 0**；补丁核验通过时为缓解 3、未缓解 0。
  新告警、范围/路径变化、缺失或改动文件和到期均继续阻断。

补丁和记录必须一起维护。上游发布修复版后，应在单独 PR 升级并移除相应补丁及记录，
保留回归用例验证正式版本，再执行冻结安装、官方源复扫和完整 CI。不得自动续期，
也不能只重算哈希来消除失败。远端验收以 PR 最新提交的 `Required checks` 为准。

## 2026-10-16：新增严重告警修复与三项豁免复审

官方源扫描在三项豁免到期当天新增 **critical 5、high 3**（原有 high 3 同时到期），所有 PR 的
`Required checks` 因安全扫描失败而无法通过。处理结果：

| 包                                       | 告警                            | 处理                                                                                                                                                     |
| ---------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @tanstack/react-start、start-server-core | GHSA-qx66-fv34-fjm8（critical） | react-start `~1.168.61`（引入 start-server-core 1.169.40）；未升到 1.169 线，该线改用新的服务端运行时（去掉 h3、srvx 1.x），会破坏现有 Web HTTP 兼容测试 |
| proxy-addr                               | critical                        | 安全下限 2.0.8（express `~2.0.7` 范围内）                                                                                                                |
| shell-quote                              | critical                        | 原下限调整为 1.11.0（detox `^1.7.2` 范围内）                                                                                                             |
| seroval                                  | critical + high                 | solid-js 下限 1.9.17（自带 seroval `~1.6.8`）；seroval 下限调整为 1.6.3                                                                                  |
| source-map-js、compression               | high                            | 安全下限 1.2.2、1.8.2（补丁级）                                                                                                                          |

TanStack 的 react-start、react-router、router-plugin 与 router-core 相互精确依赖：catalog 中
react-router 固定为 1.170.42、router-plugin 固定为 1.168.43，并用 override 把 router-core 固定为 1.171.35，
保证整个工作区只有一份 router 运行时。升级 react-start 时这几项必须一起更新。

三项本地补丁的豁免按审查复核续期至 **2026-10-30 00:00 UTC**（不超过 14 天），不是上游修复：

- node-forge 1.4.0、braces 3.0.3 仍是最新版本，公告未列出修复版本。
- http-cache-semantics 上游已发布 4.3.0，但**没有修复** GHSA-ch52：其 `max-stale` / 过期复用分支与 4.2.0
  完全相同，带 `Set-Cookie` 且 `no-cache` 的响应仍会通过 `max-stale` 返回给另一个 Cookie 的请求。
  公告的受影响范围写为 `<=4.2.0`，升级会让扫描变绿但重新引入问题，因此保留 4.2.0 与本地补丁。
  `pnpm ci:patches` 会把 4.3.0 显示为“上游有新版本”，复核结论以本节为准。
- 三项补丁文件未改动；在重新生成的锁文件上，三组补丁回归共 33 项全部通过。
  因锁文件与 workspace 变化，按复核结果重新绑定哈希，并更新每条记录的复核说明。

复核后官方源原始扫描为 **high 3、critical 0**，补丁核验通过时缓解 3、未缓解 0。到期前仍需再次复核：
上游发布真正的修复版本时，按上一节的步骤在单独 PR 中升级并移除补丁。
