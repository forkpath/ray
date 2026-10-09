# Ray 脚手架优化与验收计划

> 归档：本文是 2026-09 至 2026-10 的过程记录，保留历史失败、修复和证据路径，内容不再更新。
> 当前能力、已知限制和验收方式见 [项目现状](../status.md)。

开始日期：2026-09-30。状态：进行中。基线为已完成框架测试验收的
`3dd1b28cbbf269957144aa5ffd8b08191e3bd640`，工作分支
`codex/framework-hardening-20260930`。既有阶段 0–4 的完成不代表本轮 13 项优化已完成。

本轮保留 Ray 的可选能力、公开 API、运行时边界和真实验收标准。主工作区有大量
既有暂存内容，实施在已附属的 worktree 中进行，不改写主工作区的暂存区。

## 完整需求与验收证据

| 编号 | 要求                                                 | 当前状态                                    | 完成依据                                                                                                                                                                  |
| ---- | ---------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 无环境文件的新克隆可安装                             | 干净副本冻结安装通过，正式构建缺配置拒绝    | 仓库外干净副本不带环境与 node_modules，冻结安装成功；正式扩展配置缺失仍拒绝构建                                                                                           |
| 2    | dev 测试、main 正式的 CI/CD；命名 ray、宽度 120 一致 | 端口已释放；等待 dev/staging 发布验收       | 既有 staging SSH、镜像拉取及迁移通过；用户已停止 Nginx，80/443 无监听；补丁 PR 完整 CI 已通过；dev 正在执行；首次 TLS 签发的有界等待已本地验证；Kong/公网及 main 仍待验收 |
| 3    | CI 强制 nx format:check，并修复存量格式              | 本地与远端基线通过                          | 全仓格式检查通过；CI 必需检查包含格式失败                                                                                                                                 |
| 4    | analytics-web 冷导入测试稳定                         | 本地冷启动与远端基线通过                    | 独立冷启动及并发任务压力下重复通过，保留原断言，不靠 retries 隐藏失败                                                                                                     |
| 5    | 本地确定性完整模块 generator                         | 本地及远端真实生成与 HTTP 验收通过          | 一条 Nx 命令生成 Prisma、Domain、Repository、CQRS、Use Case、Controller、Payload、API client 和测试；干净副本生成后类型/lint/测试/真实 HTTP 与持久化通过；拒绝越界及覆盖  |
| 6    | 覆盖率门槛及跨端测试示例                             | 本地 40 项目及远端基线通过                  | Vitest 阈值在 affected CI 强制执行，降低覆盖率的负向验证失败；ui-web 组件、Web 路由示例和已有 Native/扩展示例可复制运行                                                   |
| 7    | Testcontainers 集成环境与真实仓储测试                | 本地及远端六套矩阵、镜像网关通过            | Testcontainers 启动 PG/Redis/RabbitMQ（完整服务需要 Mongo 时一并提供）；真实 Repository、Worker 去重/重试/恢复及成功/失败/中断清理验证；保持唯一默认入口                  |
| 8    | PR 前移 E2E                                          | 既有 affected Web/Extension/后端套件已实现  | PR 事件确实选择并执行页面 smoke；需要身份时使用隔离测试账号，失败传播到 Required checks                                                                                   |
| 9    | 分组依赖升级与官方源安全扫描                         | Piscina 与 node-forge 修复完整 PR CI 通过   | Piscina 4.9.4 完整 CI 已通过；新扫描 node-forge High 1，已做限期本地补丁及回归，原始报告保留 High 1、独立评估未缓解 0；PR #7 完整远端验证通过                             |
| 10   | CODEOWNERS、PR 模板及分支保护                        | dev 实际保护生效；main 规则已设，分支待晋级 | dev 已建立并成为默认分支，实际保护已读回；dev/main 严格必需检查绑定 GitHub Actions、约束管理员且禁止强推/删除；main 须待 staging 成功再晋级                               |
| 11   | 清理 lint 警告、零警告门禁                           | 本地 48 项目及远端基线通过                  | 全仓 lint --max-warnings=0 通过；新增警告能使检查失败，不全局关闭规则                                                                                                     |
| 12   | bootstrap/doctor，新人快速启动                       | 最新干净副本全栈验收 5 分 13 秒通过         | 版本与配置检查、不覆盖已有 .env、安全创建本地配置、启动 infra、db:init、显式开发 seed；隔离目录端到端计时，报告达到或未达到 10 分钟目标及条件                             |
| 13   | 拆分 AppShell 与 marketing skeleton 大文件           | 本地及远端组件、真实页面验收通过            | 按职责拆分、保持公开 API/页面行为；相关组件/路由测试、类型、lint 和页面 smoke 通过                                                                                        |

PR #7 提交 `bb2d170` 的完整 CI 已通过：48 项目质量任务、28 项后端真实集成/E2E、
生成器、Web、扩展和三平台桌面成功；Android/iOS 各 2 项模拟器流程通过，清理成功。
已合并 dev 为 `ffe60af`，新的 dev 发布流水线正在执行。node-forge 的有期限本地补丁
保留原始 High 1 告警，独立评估未缓解 0；规则见[依赖治理](../dependency-governance.md)。

用户已确认停止 staging 的 Nginx，提供的 80/443 监听检查为空；旧容器和数据卷保留。
Kong 的自动 HTTPS 配置已在无网络临时容器中解析成功，但实际证书签发与公网仍待验收。
复核当前锁定的 Kong 插件确认首次 TLS 请求会异步签发证书、先返回默认自签证书；
部署探针现先有界等待可信 HTTPS 健康就绪，再运行原有页面与认证检查。该修正不关闭
证书校验，不重试认证断言；本地真实 HTTP/WebSocket 与拒绝自签证书检查通过。
production 尚未部署，本 Goal 仍未完成。

## 实施阶段

1. 建立基线，完成安装、规范、格式、flaky 与零警告治理；进行阶段代码审核。
2. 实现 dev/main 流水线、分组依赖/安全治理、仓库治理；验证失败关闭与部署隔离。
3. 实现完整模块 generator、跨层验证与覆盖率门槛，补组件/路由样板。
4. 迁移 Testcontainers 并补真实仓储集成测试，保留已有可靠消息回归。
5. 实现 bootstrap/doctor，拆分大型 UI 文件，完成新用户路径验收。
6. 逐项结项审查、本地完整矩阵、远端同一提交 CI，记录平台与部署限制。

阶段完成时追加实际审核发现、修复、执行命令和结果。任何未运行、缺环境或未通过
项目不能以配置存在、mock 通过或旧 CI 记录替代。本轮仅在所有要求有对应证据后结项。

## 部署决策与待补信息

- 用户指定 dev 为测试环境、main 为正式环境；正式部署必须使用经过验证的同一
  提交/产物。是否复用已有 CI 取决于提交身份，不能仅因为分支名为 main 就省略门禁。
- 已创建 staging/dev 与 production/main 的 GitHub Environment 分支限制；
  2026-10-01 已核对仓库及 Environment 配置名称与公开变量，修正两套 SSH 指纹格式。
  staging SSH 身份校验、登录、文件上传、镜像拉取和迁移已通过；用户已释放此前冲突的
  80/443 端口，Kong 与公网部署仍需实际验收。用户确认 production 配置已就绪，尚未执行部署。
  具体步骤见 [GitHub 部署配置清单](../github-deployment-setup.md)。
- Testcontainers 为本轮明确要求，替换既有默认集成编排，避免新增两套维护路径。
- 保留已验证的移动原生缓存；本地先完成可复现检查，再集中触发必要远端矩阵。

## 阶段 1 进展（2026-09-30）

- 已按 120 列格式化仓库，将 workflow、Markdown 和 Prettier 配置纳入检查，
  排除生成的路由、Prisma、Native 工程和构建缓存。`nx format:check --all` 退出 0。
  CI 主检查已加入该命令，最终远端验收尚未执行。
- 基线 `lint-baseline.log` 记录 47 条 ESLint 警告。修复未使用符号、函数参数类型、
  非空断言、无用 Fragment 和 effect 依赖。Nx lint 统一传入 `--max-warnings=0`。
  JS redeclaration 规则不能区分 TypeScript 的值/类型命名空间，TS 文件改由必需的
  typecheck 检查重复声明，并保留 `no-unsafe-declaration-merging`。
- 真实负向验证：临时加入未使用变量，`email:lint` 因一条 warning 退出 1；
  临时加入重复 const 声明，`email:typecheck` 以 TS2451 退出 1。两份 fixture 已删除。
  结果见 `quality-gate-negative.json`，没有通过关闭所有 warning 或类型检查放行。
- AppShell 的路由同步提取为独立 hook，保留手动收起行为，新增 3 条导航回归通过。
  Studio 27、API client 27、Web 5、Mobile 6、Extension 9 条单测通过。
  首轮类型检查发现 calendar 的索引签名必须使用方括号，已修复并进入全仓复验。
- analytics-web 保留环境隔离与动态导入断言，超时上限调整为 15 秒，并明确配置根目录。
  `nx run analytics-web:test --skipNxCache --args=--no-cache` 在并发检查期间连续三轮
  通过，每轮 2 条测试，实际测试耗时约 1.03/2.11/1.27 秒，未配置 retries。
- wildcard 转换与修改前比较 6,220 组 pattern/separator，结果一致；Mongo `_id`
  规范化验证字符串、ObjectId、查询操作符、非法输入 4 条边界，并保持调用方 filter 不变。
  这是局部行为验证，不能替代第 7 项要求的真实数据库仓储集成测试。
- 官方 registry 扫描已实际失败并保存报告：46 个包涉及 high/critical 告警。
  干净目录中仅复制 manifest/lockfile 的扫描同样退出 1，未创建 node_modules。
  已添加扫描 workflow 和 Dependabot 分组配置；依赖修复、复扫和远端门禁仍未完成。
  具体边界见 [依赖治理](../dependency-governance.md)。
- `@forkpath` 的账户和仓库 admin 权限已通过 GitHub API 验证，CODEOWNERS 和 PR 模板已添加。
  这些文件不等于独立审阅者批准；dev/main 保护仍需在分支策略阶段落实。

上述报告位于 `dist/test-results/hardening-20260930/`；完整阶段审核及后续阶段继续进行。

- 本轮干净副本复制 1,862 个源码文件，不复制 `.env` 或 node_modules，清除应用环境变量。
  `pnpm install --frozen-lockfile` 退出 0，耗时 234.18 秒，复用了本机 pnpm 下载缓存。
  随后 `extension:build` 因缺少 VITE_API_BASE_URL/VITE_URL 明确失败；安装修复没有放宽正式构建要求。
- 新 CI 格式步骤和独立安全工作流已通过 actionlint 1.7.12；二进制从官方 release
  下载并核对该版本校验和。Dependabot YAML 已解析，远端运行及更新 PR 尚待生效验证。

### 阶段 1 本地审核结论

47 个项目的 lint/typecheck/typecheck-tests 共 101 项任务全部通过，未复用 Nx 结果缓存，
耗时 14 分 2 秒。47 个 lint 入口均执行 `eslint . --max-warnings=0`，诊断为 0 error、
0 warning；Node/Vite 的工具迁移提示不属于 ESLint 诊断，仍按原日志保留。
格式负向实验也已通过：一份故意未格式化的临时文件使 `nx format:check` 退出 1，
报告指出正确文件，随后已删除。干净安装与正式扩展缺配置拒绝的临时副本已清理。

代码自审确认：兼容 helper 的参数/返回值推导保留，debounce 正确声明异步回调入口返回 void；
导航同步从 store 读取当时状态，避免为补 effect 依赖而破坏手动收起；Mongo 查询操作符与
ObjectId 不被误转换。主工作区暂存内容没有被本轮操作改写。

本阶段没有执行新的远端或原生 CI；最终同一提交的完整验收仍属于阶段 6。
未修复的依赖安全告警、生成器、Testcontainers、覆盖率门槛、bootstrap、剩余 UI 拆分及
分支部署仍是本 Goal 的必要后续工作，不能以本阶段通过提前结项。

## 仓储与 Testcontainers 阶段验收（2026-09-30）

代码复核发现管理列表排序字段未限定，以及 CustomerRepository 仍查询旧
`reference_id` 列。现在客户/组织列表使用固定 SQL 字段映射和 Prisma 参数化，
支持已有 `user.name` 排序及个人/组织客户，修正超出末页时的总数；客户端与 DTO
共用请求校验。两个 CQRS Handler 通过独立 Use Case 调用仓储接口，路径、平台
管理员权限与响应 envelope 保持兼容，没有迁移生产数据或新增业务表。

Testcontainers 12.2.0 成为后端测试与发布镜像验证的共同编排入口，替换两份测试
Compose 文件。固定 PG/Redis/Mongo/RabbitMQ 与 Ryuk 的 image digest，随机 loopback
端口、临时身份、迁移隔离与唯一网络保留。公共镜像不读取个人 registry 凭据，
发布镜像必须在本机存在且运行 image ID 与验收记录一致。

已通过：Engine 集成 7 项、HTTP E2E 6 项，Pulse 集成 1 项、WebSocket E2E 7 项，
Worker 集成 1 项、消息 E2E 6 项，共 28 项，无失败、无跳过。
32 项相关 Nx 单测/类型/lint 检查，以及新增客户端校验的 31 项单测与类型/lint；
CI 合约 25 项。首次类型复验发现表格 SortingState 类型兼容问题，已修复并复验。
向有运行容器的独立 runner 发送 SIGTERM，报告 `c287708074eb6a44` 退出非零、
`interrupted=true, passed=false, cleaned=true`；容器、匿名卷和网络已核验删除。

### 验收边界与阶段审核

- 六套后端矩阵通过默认 Nx 入口执行，报告均为 `passed=true, cleaned=true`。
  Engine 新增的仓储测试覆盖真实表结构、个人/组织客户、默认表格排序、聚合计数、
  空页总数、搜索/provider 参数化以及绕过 HTTP 校验后的排序字段拒绝。
- 恢复旧仓储实现的隔离实验实际失败，复现 `reference_id` 缺列及空页总数错误；
  失败后 `1042914e7e8c57d5` 的环境仍清理成功，临时旧实现与测试已删除。
- 排序边界反向实验 `8b10411c0a4c66c9` 按预期产生两项失败：移除请求白名单后，
  HTTP 从约定的 400 变成 500；旧组织仓储接受了应拒绝的 SQL 表达式。实验退出非零且
  清理成功，原校验源码逐字恢复，临时 fixture 删除，证据为 `sort-http-negative.json`。
- 发布镜像编排 `bd3756770b6f38b1` 通过，实际启动四个基础服务及五个已有本地镜像，
  执行迁移、页面/HTTP/WS smoke，并验证运行镜像 ID 与记录一致、资源全部清理。
  使用的是先前提交 `5bbdf7160dc70287c10a84f3c62b39e8b63cd1bc` 的本地镜像；
  这证明新 Testcontainers 编排兼容发布验证，不代表本轮源码的镜像已验收。
- 代码审核确认排序标识符仅来自固定 Map，值使用 Prisma 参数化；现有查询路径、
  管理员权限、query key 和响应格式保持兼容，公开 `referenceId` 由当前 owner 列派生。
  两个查询遵循 Handler → Use Case → repository port → infrastructure；没有新增业务表。
- 测试 Compose 的调用引用已移除，开发/部署 Compose 保留。测试环境不复用个人数据，
  成功、失败和 SIGTERM 都验证清理；未关闭 lint、未跳过真实集成测试。

最终 `nx format:check --all` 与 Engine/API client/Payload 的测试类型及 lint 检查通过。
对六套成功、两次失败、一次中断和一次发布验证的十份报告再次检查 Docker 状态，
属于这些运行的容器、网络和已记录卷均无残留（`testcontainers-cleanup-final.json`）。
仅由 Prisma 再生成产生的四份空白差异已恢复，未纳入本阶段提交。

完整矩阵和边界报告见 `testcontainers-matrix.json`、`repositories-negative.json`、
`testcontainers-interrupt.json` 及各套件 `run.json`；均保存在
`dist/test-results/hardening-20260930/` 或其记录指向的测试目录。
本阶段未启动远端 Actions。最终提交的远端 CI、依赖修复、生成器、覆盖率门槛、
bootstrap、剩余 UI 拆分和 dev/main 自动部署仍未完成，Goal 保持进行中。

## 覆盖率与行为测试阶段（2026-09-30）

38 个 Vitest 项目接入同一覆盖率策略；CI 质量任务显式设置采集开关，沿既有 full /
affected 分支执行项目完整 `test` target。统计包括未被导入的源码，四项门槛均为正数，
数值取本轮实测基线的 90% 并向下保留一位小数，没有通过排除未覆盖业务文件提高结果。
具体实测值、范围和本地命令见 [覆盖率指南](../testing-coverage.md)。Web/Studio/UI 的
起步覆盖率仍低，这一阶段建立的是可执行的防退步门禁，不代表完整业务已充分测试。

新增行为样板：UI 的按钮、复选框和 Dialog 共 5 项；Web 正式路由守卫与真实 TanStack
导航生命周期 6 项；Native 付费墙结果/异常 6 项；Node 监控 provider 2 项；Nest DI
装配下的 Auth Guard 6 项。外部认证、支付和监控 SDK 为明确替身；正式路由和被测
组件保持真实。它们与既有 Mobile Jest/RNTL 及 Extension 浏览器测试分层保留。

- `RAY_TEST_COVERAGE=true pnpm nx run-many -t test --skipNxCache`：39 项目全部通过，
  38 个 Vitest 项目 372 项测试，Mobile Jest 6 项，共 378 项，耗时 2 分 15 秒。
  所有 Vitest 项目的 statements/branches/functions/lines 都达到对应门槛。
- UI/Web 与新增适配器测试的类型检查和 lint 通过。首次检查暴露测试中的 SDK 类型及
  路由类型注册问题，已补全 fixture、使用 Nest DI 装配并纳入生成路由类型，未使用
  `any` 或关闭类型检查放行。
- `coverage-negative.json`：临时移除 Checkbox/Dialog 测试，剩余两项断言仍通过，
  覆盖率降至 statements 0.55%、branches 0.9%、functions 0.38%、lines 0.57%，
  Vitest 因未达到门槛退出 1。随后逐字恢复原测试。
- `route-permission-negative.json`：临时去掉正式路由的管理员校验，普通用户进入
  `/admin`，路由测试因预期 `/user/profile` 不符退出 1。正式路由源码已逐字恢复。
- `unitTestGlobals` 将采集模式、策略和门槛纳入 Nx 缓存；Pulse/Worker 的显式输入
  也已接入。修改门槛文件的真实 affected 查询选中全部 38 个 Vitest 项目。
  CI 合约 25 项和缓存/边界检查通过。
- 真实缓存模式切换：同一 UI 测试先关闭覆盖率运行，再开启覆盖率运行，前者执行
  普通测试、后者命中此前覆盖率模式的正确缓存并带报告；模式之间没有串用结果。
  证据见 `coverage-cache-modes.json`。恢复后 UI/Web 的测试、类型、lint 与覆盖率再次通过。
- 全仓格式检查通过；UI 测试入口已按 `nx-generate` 技能核对现有生成器，保留专用
  Vitest 配置及真实组件测试，没有引入额外的组件生产构建流程。

原始日志、覆盖率汇总和反向实验结果保存在 `dist/test-results/hardening-20260930/`。
本阶段未增加依赖、未运行移动设备 Actions。最终同一提交远端 CI 和完整 Goal 中的
生成器、bootstrap、dev/main 部署、依赖安全修复与剩余 UI 拆分继续保留为必要工作。

## 本地初始化与诊断阶段（2026-09-30）

新增 `pnpm bootstrap --seed --start`、`pnpm dev` 与 `pnpm run doctor --running`。
初始化在依赖安装之前即可执行：验证本机工具，独占创建 0600 配置，随机生成开发密码，
隔离 Compose 项目和端口，冻结安装、迁移、显式 seed，再通过 Nx 启动四个应用。
已有环境文件保持逐字不变；外部数据库、远端 Docker、生产配置与会覆盖已校验地址的
额外 dotenv 文件明确拒绝。诊断命令必须带 `run`，以免误用 pnpm 的内置 doctor。

### 实际发现与修复

- 首轮镜像拉取阻塞在个人 Docker 凭据 helper；公开开发镜像改用临时匿名客户端配置，
  保留本机 socket 和 Compose 插件，结束后删除；个人 Docker 配置没有修改。
- 干净 seed 暴露未直接声明的 tsx；补充已锁定的 `tsx@4.21.0`，采用其正式 tsconfig
  参数。组织邀请改由单一 owner 创建，避免并发创建重复邀请；失败设置退出码并完成断连。
- Start 的 H3 与 Vite adapter 分别解析到不同 srvx 版本，实际 HTTP 复现已有响应 header
  时触发 ERR_INVALID_ARG_TYPE。窄范围 override 对齐为 0.11.22，真实 Node HTTP 回归
  验证 200/503、两个 Set-Cookie 及后续请求；没有整体重解或升级其他依赖。
- 保留 Nx 的 dotenv 加载，避免它卸载已注入的配置；启动开发 daemon 支持 watch。
  服务不再先做一次重复的 production build，关闭共用 9229 的默认调试监听。
  首次运行暴露的过期 i18n 生成类型已同步，保留原生成能力。
- 浏览器验收捕获开发网关的 200 次/分钟限流导致 Vite 模块 429 和白屏。开发环境默认
  提高为 10000，部署默认仍为 200，入口校验必须为正整数。React Scan 变为显式启用，
  PostHog 示例 key 留空，避免新项目直接加载调试外链或携带假 key 发送请求。
- 共享开发 Docker 的 RabbitMQ 实测一度占用约 572% CPU，开发配置限制 Erlang 调度
  线程数；部署配置保持独立。首次完整计时发现编译负载下 5 秒的健康探针超时，开发环境改为
  30 秒间隔、15 秒超时，继续检查真实 ping。两份认证 smoke 补充正式 Origin 请求头，真实 CSRF 仍启用。

### 当前验证证据

34 项 CI 行为合约全部通过；相关七个项目及依赖共 50 项 Nx lint、类型和单测任务
全部执行通过，耗时 8 分 6 秒，未命中 Nx 结果缓存。脚本 lint、Nx 缓存合约均通过。实际 Kong 容器入口还验证默认 200、开发 10000
和非法限流参数拒绝，生产默认没有放宽。
实际 Chromium 已验证网关首页、普通用户/管理员登录、会话、billing、profile 路由与退出；
认证 WebSocket 连接通过。重复 seed 前后均为 5 用户、5 凭据、1 组织、3 成员、2 邀请，
没有重复邀请，环境文件不变。doctor 检查五个容器和四个应用成功。

向确认属于临时副本的开发入口发送 SIGTERM 后，四个应用监听端口全部关闭；随后仅清理
该副本的 daemon、五个容器、四个卷与网络，其他项目资源未主动停止或删除。
上述调试副本多次经历源码更新，不能作为干净启动耗时证据。最终计时使用另一个不含
.env、node_modules、.nx 的源码副本，复用本机 pnpm 下载缓存及已下载 Docker 镜像。
Nx 23 会按工作区身份在用户目录共享缓存；曾有一次新副本的服务构建命中该缓存，
其 338.5 秒就绪记录只算有构建缓存的复验，不用于冷构建结论。最终计时仅在临时副本
将 Nx cacheDirectory 指向自己的 .nx/cache，并读回实际位置，主仓的正常缓存配置未修改。
最终干净副本包含 1887 个源码文件，不含 .env、node_modules 或既有 Nx 结果。
在 Intel macOS、Node 24.14.1、pnpm 10.34.5、Docker 29.4.3 / Compose 5.1.3 上：
395.2 秒四个应用连续就绪，432.8 秒真实首页可见，453.7 秒完成普通用户与管理员的
浏览器验证；含 WebSocket、重复 seed、doctor 和缓存目录读回的完整验收为 492.3 秒
（8 分 12 秒），全部通过。三个后端构建均为 0/1 缓存命中；首次数据库任务 0/2 命中，
后续 seed 仅复用本轮刚生成的 Prisma 结果。RabbitMQ 实際健康配置为 30 秒间隔和
15 秒超时，编译后的五条探针记录均退出 0，没有连续失败。

十分钟目标在上述 pnpm 下载缓存和 Docker 镜像已存在的条件下达到；未验证完全无下载
缓存的网络耗时，也未把本机 macOS 结果扩大为 Windows/Linux 完整启动验收。两份
认证 smoke 均在真实启动环境通过，源码和配置没有按测试结果放松正式认证校验。

证据目录为 `dist/test-results/hardening-20260930/`，包含失败尝试、真实 HTTP 反向实验、
浏览器错误、重复 seed 和资源清理报告。此阶段未触发远端或移动原生 Actions；最终同一
提交的远端 CI、完整 generator、dev/main 自动部署、依赖安全修复与剩余 UI 拆分仍待完成。

## 生成器阶段补录（2026-09-30）

提交 `8e1e916` 已实现 `@ray/plugin:resource`，包括个人/组织归属 CRUD、真实仓储、
公开契约与客户端、离线迁移和可执行测试。临时副本中真实调用 Nx 生成两种资源，
检查 dry-run、重复生成拒绝、层次依赖、类型、lint、覆盖率以及真实 HTTP/Postgres。
额外移除 DTO 校验和 owner 条件的反向实验均使对应 HTTP 测试失败，随后恢复并清理。
最终记录 `dist/test-results/ray-plugin/2026-09-30T04-14-11.522Z/acceptance.json`
为 `passed=true, cleaned=true`；`generator-commit.json` 记录提交与主工作区暂存区校验。
这补正了上表此前仍显示“待实施”的状态；该提交的远端 CI 仍未执行。

## UI 拆分阶段验收（2026-09-30）

AppShell 入口由 686 行缩至 110 行，主菜单、用户菜单、路由动作和悬停生命周期分别
提取；类型和公开导出保持兼容。悬停状态改为单一当前菜单，跨菜单互斥，进入 portal
保留菜单，选择后取消待执行打开，卸载清理定时器。新增 7 条路由动作/计时器回归。
两份 marketing skeleton 入口由 608/675 行改为导出入口，按演示组件、SVG 连线、
聊天消息和静态部署数据拆分。AST 对比 20 个原声明：18 个 initializer 完全一致，
其余两个变化分别是静态数组提取和发送按钮的无障碍名称。

已验收：

- Studio、Web、Desktop、Web E2E 的 lint/typecheck/typecheck-tests/test 与依赖共
  26 项 Nx 任务通过；启用既定覆盖率门槛，不降低阈值。后续新增 E2E 断言另跑 lint/typecheck。
- Chromium、Firefox、WebKit 的正式 Web bundle 页面流程全部通过，覆盖模型演示、
  Enter/按钮发送、工作流标签切换和手机宽度下的发送。完整场景总时限为 90 秒，
  单条断言时限保持 5 秒，不设置 retries；顺序复验共 51.4 秒。
- 隔离数据库 seed 的普通用户和平台管理员通过真实 Engine 登录，Web 生产构建经
  Kong 访问；两个侧栏场景全部通过，包含用户/管理员路径切换、记忆最后子页面、
  管理列表默认分页参数、悬停选择、手机菜单选择后关闭及带 Origin 的注销。
- 实际 macOS x64 Electron 测试包通过 UI、preload、认证路由重载和窗口 IPC。
  此套件使用已有认证 mock；Desktop 当前没有接入 AppShell，不把它算作 Desktop
  AppShell 或真实登录验收。

首次尝试的漏导入、重复文本定位、测试总时限、注销 Origin 与默认分页断言问题均保留
失败记录并修正。Docker 曾返回 500，并发验收期间 bootstrap 曾因 Engine 启动超过
时限失败；这些不计为通过。之后按顺序完成服务启动，并在真实页面验收入口确认端口
空闲及 HTML 为生产产物，避免误用之前的开发服务器响应。该次启动不用于重算第 12 项
十分钟目标。截图仍可见既有组织标题/账号标签的翻译键缺项，本次未声称完成翻译修复。

记录在 `dist/test-results/hardening-20260930/ui-*`；最终普通用户与管理员 JUnit 为
2 passed、marketing JUnit 为 3 passed，Electron 日志包含实际打包应用验证结果。
四个应用端口关闭，五个临时容器及其卷/网络已清理，见 `ui-final-cleanup.json`。
本阶段没有触发远端或移动原生 Actions；依赖安全修复、dev/main 发布与合并保护、
最终同一提交的远端验收继续保留为本 Goal 未完成项。

## 依赖治理阶段验收（2026-09-30）

认证工具切换为与运行时一致的 `auth@1.6.26`；Nest adapters 对齐 11.2.6，
Vitest 工具组对齐 4.1.11，Electron 固定 41.10.7。修复受影响的传递依赖范围，
保留 Expo/React Native/React 配套版本；Mobile 和 Extension 补全实际直接导入的
包声明，版本放入 catalog。没有使用 audit 忽略名单或执行自动 audit fix。

修复前的复扫为 high 169、critical 9；最终官方 registry 扫描退出 0，high/critical
均为 0，low 12、moderate 58 保留在报告中。最终在不含 `.env`、`node_modules` 的
源码副本完成冻结安装，pnpm 用时 2 分 53 秒；复用本机下载缓存，没有把网络完全冷启动
作为本次计时条件。之前已有依赖目录的 14.1 秒复验不计为干净安装耗时。

已通过 40 项目单测及既定覆盖率门槛、48 项目的 106 项 lint/类型任务；修复后另跑
29 项相关任务。真实后端六套共 28 项全部通过，容器/网络/卷核验无残留。Web 的
Chromium/Firefox/WebKit marketing、Extension 的 Chromium 7 项和 Firefox 打包、
Electron macOS x64 UI/仓外 smoke/更新流程通过。Mobile iOS/Android Hermes 与 Web
导出通过（8 分 54 秒）；认证 schema、36 项 CI 合约、全仓格式和 Nx 缓存合约通过。
升级后的生成器在新临时副本中通过个人/组织资源生成、dry-run、覆盖拒绝、全层检查，
以及含生成模块的 10 项真实 HTTP/PostgreSQL 测试；用时 9 分 1 秒，报告和实际资源
状态均确认清理。此次没有重做此前已通过的 DTO/owner 条件移除反向实验。

阶段审核发现并修复了三处升级边界：Vite 8 的 JSX 配置、SWC 产物被 Oxc 再次转换
造成派生类在 `super()` 前初始化成员、Worker 单测 DI token 意外触发数据库初始化。
Electron 未签名测试进程曾等待真实 macOS Keychain；临时测试入口改用 mock Keychain，
并确保启动失败也删除临时 profile。正式应用安全配置不变，真实签名/钥匙串行为另行验收。

命令、初次失败、修复复验和平台边界见 [依赖治理](../dependency-governance.md)；原始
证据为 `dist/test-results/hardening-20260930/dependency-*`。主工作区暂存区未改写。
此阶段未触发远端 Actions；当前提交的移动设备、其他桌面平台、远端必需检查仍待运行。
dev/main 自动发布和合并保护尚未落实，完整 Goal 继续进行。

## dev/main 发布机制阶段（2026-09-30，验收进行中）

dev 推送先通过 `Required checks`，再由同次 CI 调用 staging 构建与部署；
main 只接受同一 SHA 的成功 dev CI、成功 staging 记录及五个不可变镜像 digest。
生产前再次扫描依赖，拒绝失败、进行中、过期、其他仓库/提交或其他 attempt 的记录；
真正上传前复查分支 head。两个环境串行部署，不在部署中途因新推送取消。

代码自审已修正：

- 安全扫描是必需汇总检查的前置条件；dev/main 分支与 Nx defaultBase 对齐。
- Web 邀请地址使用浏览器当前 origin，SSR/file 保留 canonical URL；同一前端产物
  可以在 staging/production 使用。对应两条测试、Studio 测试类型检查和三浏览器页面回归通过。
- 基础设施与 Kong 固定 digest，Testcontainers 读取部署 Compose 的版本；开发 Compose
  与 CI 临时 PG 的版本由合约测试约束。服务内网 Redis/Mongo 端口显式固定，避免继承宿主映射端口。
- 发布标签原来同时启动独立 CI 和发布流程内 CI；现在只由发布流程调用一次完整矩阵。
  普通 dev 保持 affected，完整定时矩阵改为每周，原生编译缓存保留，镜像增加按服务区分的 BuildKit 缓存。
- 保留可复用 CI 所需的调用方权限上限；标签调用传入 ref，不能进入 dev 自动部署步骤。
- 两个 GitHub Environment 已实际创建并读回：staging 仅允许 dev 分支，production 仅允许 main。
  环境分支限制不等于服务器、SSH 凭据或 HTTPS 已准备好。

当前已通过 44 项 CI 行为合约（含真实本机 HTTP API fixture 和无 node_modules 的
promotion 子进程）、全部 workflow 的 actionlint、相关脚本零警告 lint、全仓格式、
Nx 缓存/边界合约、四应用构建与三服务 runtime package。
官方源复扫 high/critical 均为 0，low 12、moderate 58 保留。
Engine 新 Testcontainers 入口再次通过真实 PG/Redis 集成 7 项，报告
`ab6d73af69ba51c7` 为 passed/cleaned=true、interrupted=false。

隔离部署演练正在执行：五个当前代码镜像构建已通过；最初两次在本机临时 registry
推送阶段失败，均完成清理，没有执行部署。诊断确认主机转发端口不等于 Docker daemon
可访问的回环端口；独立 daemon 回环 registry 推送探针已通过，完整演练继续执行。
第三次演练已推送五个不可变镜像并调用真实 deploy.sh，但 RabbitMQ 的健康诊断连续超过
5 秒上限，基础设施阶段失败，应用尚未替换；容器、网络、卷和临时文件已清理。
现已仅限制诊断 CLI 的 Erlang scheduler，保留 broker 的容量配置，并使用 check_running、
15 秒检查超时及 30 秒启动宽限期。第四次完整隔离演练失败，日志定位到 root 健康探针
抢先创建 Erlang cookie，broker 随后因 `eacces` 无法读取；本轮资源也已清理。
开发与部署 Compose 的探针现改为通过 `gosu rabbitmq` 运行，与 Testcontainers 一致。
独立空卷实验 `rabbitmq-fresh-761eee1471ed.json` 先复现 root cookie 导致启动失败，
再验证实际部署/开发配置分别在 96.8/37.2 秒启动健康，cookie 均为
`rabbitmq:rabbitmq:400`。三个场景均符合预期，容器、网络、卷及临时文件全部清理；
44 项 CI 行为合约再次通过。该定向复验不替代完整部署演练，后者仍待修复后重跑。
该测试只使用本机临时 registry、目录与数据，不代表真实服务器或公网 HTTPS 部署通过。
本次远端读回确认：`93cc3b1` 已上传加固分支；默认分支仍为 arch，arch 的严格
Required checks 与管理员保护已生效。PR #1 的 15 项检查通过于旧提交 `3dd1b28`；
最新加固提交的完整远端 CI、dev/main 保护与真实环境部署仍需完成，Goal 保持进行中。

### 网关与仓库治理复验

GitHub 已创建并读回 dev/main 保护规则：dev 要求 `Required checks`，main 额外要求
`Staging deployment`；检查绑定 GitHub Actions，严格检查和管理员限制开启，禁止强推与删除。
尚未验证初始分支创建；新分支及默认分支切换将在本地完整演练通过后执行并核对保护。
现有移动编译缓存属于 `refs/pull/1/merge`，不能被新 dev 的 push 运行读取；首次 dev
运行建立默认分支缓存后，后续 PR 才能共享。保留按工具链分开的 Gradle/CocoaPods 缓存。

干净提交 `ab93187` 的完整演练 `ab718df617fe` 已通过五个镜像构建、推送、迁移与所有服务
健康检查，但网关首页返回 502，因此整次结果仍为失败，全部资源已清理。小规模实际容器
实验 `kong-dns-8d79496a9d.json` 证明 Docker 的 `web` A 记录是正确的内网地址，而 SRV
查询返回公共 `.web` 域的记录。默认解析、清除搜索域、显式 Docker DNS 均返回 502；
仅改为 `LAST,A,CNAME` 后返回 200。四个对照场景的资源均已清理。

两套 Compose 现固定此 DNS 顺序。现有 Testcontainers 发布镜像入口同时增加真实 Kong，
使用部署模板和同一 DNS 策略；发布门禁拒绝缺少网关验收的报告，避免仅凭服务自身健康
发布无法从外部访问的镜像。当前源码的五个本地镜像已通过新增网关验收，报告
`934a92cc17ea9fbf` 为 passed/cleaned/gatewayVerified=true、interrupted=false；
页面、健康检查、HTTP session/权限和 WebSocket 认证边界均通过实际 Kong。
45 项 CI 行为合约通过，相关脚本零警告 lint 通过。清理断言移至独立函数，保持
失败退出与资源核验语义，避免 finally 内直接抛错。共享入口的 Engine 集成回归
7 项通过，报告 `7b6e3587c7af7347` 为 passed/cleaned=true、interrupted=false。
此结果不替代两环境完整部署演练，也不代表真实服务器或最终提交远端 CI 已通过。

### 两环境完整部署演练通过

提交 `5bfdeab3bd35274721496bb021f7717303902711` 的隔离演练
`b2995d7520c8` 已完成，开始时无工作区差异。通过真实 `deploy.sh` 依次验证：

- 五个当前源码镜像推送到本机临时 registry，按 digest 部署。
- staging 的空库迁移、四个应用与 Kong 健康、页面与 HTTP/WS 认证边界通过。
- 故意失败的 migrator 返回 17；四个既有应用容器 ID 保持不变，网关仍通过检查。
- staging 重复部署成功；production 在另一套独立数据与网络中使用相同五个 digest，
  应用运行 image ID 与记录一致，网关再次通过。
- `passed=true, cleaned=true, interrupted=false`，清理错误为空，临时文件已删除。

原始结果为 `dist/test-results/hardening-20260930/promotion-rehearsal-b2995d7520c8.json`。
这是本机隔离验收，未覆盖远端 SSH、公网 HTTPS 和实际 GitHub Environment 部署。
远端读回仍没有仓库构建变量及 staging/production 部署变量或凭据；已经询问的环境信息
仍待提供。下一步建立实际 dev 分支并执行最终远端矩阵，真实 CD 不能用本机演练代替。
入口复核同时修正 README 的工具目录说明，使其包含新增的本地 Nx 业务生成器。

### 启动与远端基线复核

dev 已在 `ee3996e` 建立并成为默认分支，实际分支保护读回确认严格的
`Required checks`、管理员限制与禁止强推/删除。main 规则保留，但正式分支尚未晋级。
该提交远端的安全、格式/质量、数据库、生成器、三后端、Web、扩展、三桌面平台、
Android/iOS 原生及设备流程全部通过。首次 dev Gradle 和 Xcode 编译缓存已保存，
API 读回确认缓存属于 `refs/heads/dev`，约 2.32 GB 与 0.67 GB。
最终 `Required checks` 与 `Staging deployment` 没有执行任何步骤即失败：GitHub
注解明确报告账户近期付款失败或支出上限不足，实际 staging 部署被跳过。
已向用户报告；恢复后补跑失败环节，不重复已成功的原生任务。整条 CI 尚未通过。

最新启动复核先保留两次失败证据：首次冻结安装成功，但 Docker image inspect 返回
500；随后同一查询恢复，原因未证实。继续初始化后，三后端并行类型检查使 Engine
超过启动就绪期限，整次仍记为失败。没有用此前 8 分 12 秒的旧结果替代本次验收。

`7ca79aa` 仅让三个后端的 development 构建跳过重复类型检查，保留 tsc 转译、独立
Nx typecheck 与生产构建检查。临时副本故意加入类型错误时，独立 typecheck 和真实
生产构建均以 TS2322 拒绝；源码恢复。正常代码的 lint/typecheck/生产构建共 29 项
任务通过；全仓格式检查通过。Nx 受影响范围为 Engine、Pulse、Worker 和生成器，
无需为这项后端启动优化重复运行原生矩阵。

当前代码的 1941 文件独立副本不含 `.env`、node_modules 或既有 Nx 构建结果，
只复用 pnpm 下载缓存与本机 Docker 镜像。冻结安装 88.9 秒，四应用连续就绪 254.0 秒，
普通用户及管理员真实浏览器验证 286.4 秒；加上认证 WebSocket、重复 seed、环境文件
保留及最终 doctor，共 313.4 秒，全部通过。Engine 编译未命中缓存，用时 28.7 秒。
停止后四个应用端口关闭，五个专属容器、网络与数据卷已清理。

证据位于 `dist/test-results/hardening-20260930/bootstrap-optimized-*`、
`bootstrap-typecheck-gate-probe.json` 和 `bootstrap-optimization-checks.log`；
此前失败与开发启动实验单独保留。真实部署所需的服务器、域名和 GitHub Environment
配置仍待提供；本地演练通过及分支保护生效不能替代实际 CD。

### 配置恢复后的真实发布复验（2026-10-01）

配置指南已随 PR #3 合入 dev，两环境的 Variables 和 Secret 名称完整，SSH 指纹字符串
已规范化为单独的 `SHA256:...`。GitHub 不允许读取 Secret 明文，其实际有效性必须通过
发布连接验证。PR #3、#4、#5 的测试汇总均通过；本轮代码变更进行了自审，不记作独立评审。

dev 的 [CI 36844617422](https://github.com/forkpath/postfly.io/actions/runs/36844617422)
对应 `0dc5a63cee84b4f440815717c82a10651186e4dc`：

- 全仓格式、零警告 lint、类型、单测/覆盖率、数据库、生成器、三后端、Web、扩展及
  三桌面平台验收通过，`Required checks` 成功。
- 双端原生验收通过于 `85b80d9` 的 CI `36828632796`，报告均为 passed/cleaned=true。
  此后仅修改发布、选择器和文档；移动端运行时、依赖、工具链及设备任务均未改变。
  PR #5 对完整工作流进行结构比较后保留全仓质量检查，避免重复设备构建。
- 修复了跳过的可选任务连带阻止 staging 发布的问题。实际 dev 运行证明：mobile
  跳过时，成功的测试汇总仍能正常进入 staging，失败或取消仍不允许部署。
- 修复发布 runner 构建第四个镜像时的磁盘耗尽：清理临时 runner 的闲置预装工具链后，
  可用空间从 13G 增至 35G，五个镜像构建后仍有 24G；保留 Docker 和构建缓存。
  五个确切发布镜像的迁移/网关验收与 GHCR 上传均成功。
- staging 部署到达 SSH 握手，但上传步骤报 `ssh: host key fingerprint mismatch`。
  配置格式检查成功不等于主机身份匹配。固定的客户端默认可能先协商 ECDSA，而原指导
  仅提取 ED25519 指纹不够完整，已在配置指南中补充主机密钥类型与可信控制台核对步骤。
  实际协商密钥和目标主机仍待可信信息确认，未关闭校验或采用未核验的网络指纹。

服务器迁移、镜像拉取、应用健康和公网 HTTPS/WS 尚未执行；main 仍未创建，production
未部署。已有五镜像和成功测试可供重跑失败部署使用，不应重复完整原生矩阵。
因此实现、阶段自审和所选远端测试已有证据，真实 CD 与整体验收仍未完成，Goal 不能结项。

### SSH 指纹恢复及服务器配置检查（2026-10-01）

用户从两台服务器的可信控制台提供了 ECDSA、ED25519 和 RSA 公钥指纹。两套
Environment 已改用各自 ECDSA 的 `SHA256:...` 字段并读回确认，没有关闭主机身份校验。
同一 dev CI 的 [attempt 2](https://github.com/forkpath/postfly.io/actions/runs/36844617422/attempts/2)
只重跑失败部署与汇总，成功测试和五镜像构建的起止时间与 attempt 1 相同，未重复执行。

staging 的主机身份校验、密钥登录与控制文件上传通过，远程脚本已执行；随后明确报
`Missing environment file: /opt/staging/.env` 并退出 1。这证明 SSH 阻碍已解除，但应用
运行配置尚未准备到工作流指定位置。失败发生在 GHCR 登录、镜像拉取和数据库迁移之前，
容器健康、公开 HTTPS/WS 和 production 均未验收。

配置指南已补充 GitHub 配置与服务器 `.env` 的区别、仅输出文件就绪状态的检查命令，
以及只重跑失败部署的命令。已请求核对两台服务器的运行配置，文件位置必须与各自
Environment 的 `DEPLOY_PATH` 一致。dev 暂不前移，保留当前已验证镜像，待运行配置
就绪后继续同一提交的部署验收。

### 服务器运行配置恢复及网关端口检查（2026-10-02）

用户确认 staging `/opt/staging/.env` 已创建、production `/opt/production/.env` 已填写。
同一 dev CI 的 [attempt 4](https://github.com/forkpath/postfly.io/actions/runs/36844617422/attempts/4)
仅重跑失败部署；17 个成功任务的起止时间保持不变，未重建镜像或重跑原生设备。

staging 实际通过 SSH、GHCR 拉取、四项基础服务健康检查，并成功应用
`20260921000000_init` 数据库迁移。Engine、Pulse、Web 健康检查通过；Worker 已启动，
该次日志尚不能证明其最终健康状态。Kong 启动时明确报 `failed to bind host port
0.0.0.0:80/tcp: address already in use`，导致部署退出 1；公网 HTTPS/WS 探针未运行，
没有生成可晋级记录，production 未执行。

已请求服务器端口占用的只读检查，需根据现有服务确定网关入口归属。不会为了通过部署
直接停止未知服务或删除持久卷。配置指南已补充端口预检；保留当前 dev SHA 与已发布镜像，
解决入口冲突后继续重试该部署。

### 新披露构建依赖告警（2026-10-02）

文档提交 `de67205` 的 [CI 36894893284](https://github.com/forkpath/postfly.io/actions/runs/36894893284)
在官方源安全扫描中被 Piscina 4.9.3 的新 Critical 公告阻止。该变化意味着即使解决端口冲突，
旧 dev 提交的 production 安全复扫也不能通过，不能继续只依赖旧镜像晋级。

现有 4.x 安全下限已升至 4.9.4，锁文件仅五处对应替换。冻结安装、安全复扫、旧版失败/
新版通过的隔离 Worker 探针、真实 SWC CLI 并行编译和三个后端生产构建通过。
后续由新提交的完整 CI、镜像验证和实际部署继续验收，沿用缓存且不降低原生任务选择规则。
详细来源和验证边界见 [依赖治理增量](../dependency-governance.md#2026-10-02-扫描增量)。
