# 框架测试与 CI 实施方案

> 归档：本文是 2026-09 至 2026-10 的过程记录，保留历史失败、修复和证据路径，内容不再更新。
> 当前能力、已知限制和验收方式见 [项目现状](../status.md)。

状态：2026-09-29 结项复核。阶段 0–4 的实现、阶段代码自审与本方案范围内的整体验收均已完成。提交 `3dd1b28cbbf269957144aa5ffd8b08191e3bd640` 的 [完整 CI 36554712030](https://github.com/forkpath/postfly.io/actions/runs/36554712030) 共 15 项检查成功，包含 Android/iOS 模拟器 E2E 和 `Required checks`；合并保护与失败阻断也已验证。证据、审核范围与专项验收边界见 [阶段验收记录](2026-09-testing-framework-validation.md#goal-结项复核2026-09-29)。本次结项不包含 PR 合并、生产部署或签名上架。

## 目标与责任边界

Ray 提供可复用的跨端开发框架。框架维护者交付测试配置、运行命令、隔离环境、可复用 fixture、少量真实框架行为用例、报告和 CI 接法。业务开发者在这些入口编写自己的领域规则、页面操作和完整业务流程测试。

框架自带的认证适配、会话传递、组织订阅授权、协议校验、消息重试、应用启动和升级都是已有能力，应验证它们的公开承诺。不要为展示测试新建订单、支付、客户管理等业务模型，也不要仅提供空配置或恒真的示例。

| 套件         | 内容                                                 | 执行原则                                           |
| ------------ | ---------------------------------------------------- | -------------------------------------------------- |
| 框架核心     | 启动、协议、错误映射、认证接入、适配器契约、资源清理 | 对应模块改动时必须执行                             |
| 框架可选能力 | 已支持的存储、短信、邮件、监控等适配器               | 本地契约测试按影响范围运行；真实厂商测试显式启用   |
| 业务示例     | 仓库已有的业务演示及将来使用者的用例                 | 单独标识、独立数据准备，不作为框架初始化的前置条件 |

第三方能力不能因为没有当前消费者而删除。默认测试不要求购买服务或配置生产凭据；可选真实集成未启用时报告“未运行”，显式启用但缺少依赖时报告失败，不能静默跳过后声称通过。

## 工具选择：统一使用方式，按运行时选择执行器

| 运行时                             | 单元／组件测试                                  | 集成／端到端测试                                        |
| ---------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| Mobile 的 RN 组件、Expo 模块、路由 | Jest + jest-expo + React Native Testing Library | Maestro 驱动 Android Emulator / iOS Simulator           |
| 与平台无关的 TypeScript 库         | 保留 Vitest                                     | 按公开契约补必要集成测试                                |
| Web、Extension 的 React DOM 组件   | Vitest + React Testing Library                  | Playwright；扩展必须加载真实扩展产物                    |
| Desktop main / renderer            | 保留 Vitest，分别使用 Node / DOM 环境           | 保留现有 Electron E2E、打包运行和升级验证               |
| Engine / Pulse / Worker            | 保留 Vitest，按需使用 Nest TestingModule        | Vitest + 真实 HTTP / ws / RabbitMQ 客户端及隔离基础设施 |

不为统一名称把 RN 强行迁到 Vitest，也不把现有 Node/Web 测试全部改成 Jest。jest-expo 提供 Expo 原生模块的测试适配；Vitest 的 Node/jsdom 环境不等于 RN 原生运行时。现有 native 库中只测纯逻辑或 SDK port 的 Vitest 测试可以保留，真正渲染 RN 组件的测试使用 Jest。

统一 Nx target 的含义、CI 行为、fixture 生命周期及报告目录即可。不要自建兼容 Jest/Vitest 的断言框架；共享纯测试数据，平台 mock 和测试全局类型分别配置。

## 已提供的公共入口

以下入口已按对应项目的测试职责实现，并通过 Nx 解析配置与实际执行核验。以后创建项目或增加结构时，仍先遵循 nx-generate 流程，并检查当前 Nx 插件支持。

| 入口                                                | 含义                               | 缓存策略                              |
| --------------------------------------------------- | ---------------------------------- | ------------------------------------- |
| `pnpm nx run <project>:test`                        | 快速单元／组件测试，执行后退出     | 允许 Nx 缓存，声明完整 inputs/outputs |
| `pnpm nx run <project>:test-integration`            | 真实模块、数据库或消息适配器协作   | 初期禁用缓存                          |
| `pnpm nx run <project>:e2e`                         | 应用／服务启动后，从外部入口验证   | 禁用缓存                              |
| `pnpm nx run mobile:e2e:android` / `mobile:e2e:ios` | 平台构建、安装和设备流程的编排入口 | 设备执行禁用缓存                      |

只给有相应测试职责的项目添加 target，不给每个 lib 创建空 E2E。保留已有 `web-e2e:e2e`、`desktop:e2e`、`desktop:smoke`、`desktop:update-e2e`；将 `extension:smoke` 保留为兼容入口，避免已有用户命令失效。

- 单测与集成用例分开收集。新加 `*.integration.spec.ts` 时必须从现有单测 include 中排除；Playwright 与 Jest 用例也不能被根 Vitest 再次收集。
- Jest globals 和 RN 测试类型仅进入对应测试 tsconfig，不污染其他项目。Expo Router 的测试文件放在 `src/app` 之外。
- 默认 `test` 不进入 watch，watch 为开发者主动选择的模式。
- 结果统一落在 `dist/test-results/<project>/<suite>`，覆盖率在 `coverage/<projectRoot>`；既有 Desktop 报告路径先保留并由 CI 收集。
- 新入口必须包含非零真实行为测试。断言失败必须使 Nx 和 CI 返回失败；不使用 `passWithNoTests` 制造通过结果。
- fixture 先与测试项目共置；只有出现多个真实消费者时，再提取符合 Node/Web/Native 边界的测试库，不创建混合所有运行时的大型公共 barrel。

## 各运行时的最小框架验收

### Mobile

交付 Jest 配置、Expo SDK 匹配的依赖、pnpm isolated 布局下的转换配置、RN render helper、原生模块 mock 示例、路由测试 fixture 和 Maestro 目录。

单测示例选择已有 Provider/组件的一项可观察行为，以及一个原生适配器的成功和失败结果。避免大量 UI 快照，避免仅测试 mock 本身；至少有一个测试实际渲染仓库的 RN 组件并触发交互。

Maestro 流程使用 YAML；复杂表达式可使用它支持的 JavaScript。它不是 TypeScript 测试 runner，脚本环境也不是完整 Node.js。初始化数据、启动服务、生成配置等复杂编排放在外部 Node/TypeScript 工具中，向流程传入参数，避免把业务逻辑写进 YAML。

提供无需生产账户的 E2E 构建 profile：Android 可安装 APK、iOS Simulator `.app`，固定平台工具版本及测试应用标识。应用包含匹配的 JS bundle，避免依赖开发者手动启动 Metro 或操作 Expo Go。测试编排自动完成构建、启动模拟器、等待就绪、安装、重置状态、运行流程、保存日志／截图及清理。

框架示例只验证启动到稳定页面、导航与返回、已有深链接入等基础能力；不存在的能力不为测试而虚构。所有测试 hook、假服务与演示 fixture 只在测试构建或隔离环境启用，正式产物不能绕过认证。

默认选择本地 Maestro CLI，可在 GitHub Actions 的适配 runner 执行；EAS Workflows 或 Maestro Cloud 作为可选执行后端，不要求框架使用者必须订阅。Android 与 iOS 都需各自验证，iOS 本地／GitHub runner 需要 macOS/Xcode。模拟器流程可无人值守，但不等于真机硬件、商店支付或签名发布验收。只有使用相关能力的项目才接入这些专项测试。

若未来团队明确要求用 TypeScript 编写设备测试，或需要更深入的 RN 内部同步控制，再评估 Detox；不同时维护两套默认设备 E2E。

### Extension

新增独立 Vitest 配置。优先验证 WXT 的 `WxtVitest` 插件与当前锁定的 WXT/Vite/Vitest 组合兼容性；它提供 browser API 替身与 WXT 配置支持。当前 WXT 配置会读取根环境并加载构建插件，测试接入必须显式隔离配置，避免读取开发者真实环境或运行无关构建任务。

单测覆盖框架的消息分发、存储封装及错误处理；React 页面按需使用 jsdom。browser API 替身每例重置，但它不能证明浏览器权限、content script 注入或 background 实际运行正常。

将已有 `scripts/smoke.mjs` 的有效检查迁入或封装为标准 Playwright 套件，保留真实扩展产物、独立浏览器 profile、background/content/popup 等边界。增加标准报告、trace 和失败截图；外部 HTTP 服务可使用受控替身，但扩展消息和 storage 不替换。

CI 顺序为：安装锁定依赖 → 单测与类型检查 → 构建扩展 → 安装对应 Playwright Chromium → 运行扩展 E2E → 无论成功失败都收集诊断文件。相关 PR 执行 Chromium 套件，发布使用同一已验证提交和产物。

Playwright 的扩展加载方案针对 Chromium；普通 Firefox 页面测试不能替代 Firefox 扩展验收。保留 Firefox 构建检查，将实际 Firefox 扩展加载与行为验证列为单独验收项，选定工具并实测后才声称支持。

### Engine

提供可复用的应用启动／关闭 fixture、HTTP 客户端、临时数据库、测试会话创建与清理工具。测试与实际启动复用全局前缀、DTO validation、异常过滤、认证、中间件配置，避免测试应用与发布应用装配不同。

最小真实链路验证：模块能启动；非法请求被拒绝；框架错误能映射为公开响应；Better Auth 会话经真实 HTTP 被识别；受保护的测试资源拒绝无会话或越权访问；数据库适配器能够写入和读取隔离记录并验证必要约束。

使用现有框架模型或测试专用 fixture，不新增产品资源。内置认证集成应使用一次性测试用户和真实会话，而非在该套件中 mock 掉认证。数据库连接错误不能降级成内存仓储然后仍标记集成测试通过。

### Pulse

提供真实 ws client、握手／消息断言、受控认证 fixture、Redis 与数据库隔离环境，以及有截止时间的消息等待工具。

验证已有框架协议：合法／非法连接、非法消息、组织订阅授权、断开清理、服务 drain，以及多实例经 Redis 的消息分发。授权检查基于真实 Session 和临时成员数据；不模拟任意产品通知。可复用现有 platform smoke event，但只在隔离测试环境启用。

不要把“能连接”当作全部协议通过；多实例测试必须实际运行两个实例，Redis pub/sub 要走真实网络。

### Worker

提供 RabbitMQ publisher、独立队列／vhost、数据库 fixture、可控成功／失败 handler 和清理工具。复用现有 platform smoke event 及 Inbox 能力，不创造订单等产品事件。

验证真实投递、ack、Inbox 并发认领与去重、失败重试、重试耗尽进入 DLQ、未知版本拒绝、租约过期及进程重启后的恢复。断言同时观察队列状态和持久化结果，不仅检查 `publish` 是否被调用。

如测试发现框架宣称的能力缺失，应修复或收窄明确承诺，不能修改测试绕过。RabbitMQ 的至少一次投递与 Inbox 去重不自动等于外部副作用“恰好一次”；事务型副作用和外部幂等键由其各自契约验证并给出接入示例。

当前 Worker 的完整 AppModule 还直接导入 Mongo。验证完整应用启动时要提供隔离 Mongo；仅测试 RabbitMQ/PG 适配器可以使用较小测试模块，但报告必须注明覆盖边界。是否将 Mongo 改为显式可选组合是独立架构调整，不能为跑测试而静默移除。

### Web / Desktop

保留当前可用的测试及生产构建 smoke。核对 Web 的单测入口并按需补 Vitest/DOM 配置。框架级 E2E 验证应用壳、Provider、路由、公开 bridge 和资源加载；与需要具体业务账户的历史示例分开。

Web 现有 API 示例的 `/api` 与实际 `/api/v1` 不一致应修正并在隔离 Engine 验证，不能只改路径后宣称通过。Desktop 保留多系统、打包运行及升级测试；正式签名升级验收单独标识，不用无签名检查代替。

## 测试环境与 CI

原阶段采用专用 Compose；后续脚手架优化现已将默认入口统一为 Testcontainers，按套件启动 PG、Redis、RabbitMQ、Mongo，不复用开发卷。集成与发布产物验收共用同一基础设施实现，详见 testing-backend.md。

每次运行独立命名空间、数据库和消息队列，使用测试生成的凭据；明确检查隔离目标后才迁移或重置。fixture 初始化、健康等待、日志收集与清理均由 runner 编排；就绪检查有超时，不依赖固定 sleep。并发任务不可共享可写状态，失败后同样清理。

| 时机           | 默认执行                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| PR             | affected lint/typecheck/test/build；相关后端的核心集成套件；相关 Extension 的 Chromium E2E；已有 Desktop 检查 |
| Mobile 相关 PR | 单测、类型检查、导出；原生依赖／配置变化需原生构建及平台 E2E；普通 JS 改动可先用较小设备矩阵                  |
| 主分支／定时   | 框架回归；Android+iOS、桌面平台、多浏览器及 Pulse 多实例／Worker 恢复套件                                     |
| 发布前         | 同一提交及待发布产物的必要验证，失败则不发布；Mobile 测试包与商店包差异单独验证                               |
| 部署后         | 可控的框架启动、认证／协议 smoke；失败使发布结果失败，保留诊断和回退入口                                      |

工具和镜像固定版本；Native 构建缓存需要考虑 SDK、原生依赖和构建 profile。真实环境／设备测试初期不使用 Nx 结果缓存。CI 上传 JUnit、适用的覆盖率、trace、截图和服务日志；对重要框架模块逐步建立覆盖率基线，不统一强制任意 100% 数字。

“必须通过的检查”就是：检查失败时禁止合并或发布。GitHub 的必需检查设置与 YAML 中的 job 是两层，落地时需要核实仓库分支规则。采用受影响项目选择与统一结果汇总，避免路径跳过导致 required check 永久等待。必跑套件缺少依赖、凭据或零用例时应明确失败；可选套件必须单独展示未运行状态。

## 实施顺序与完成依据

| 阶段                    | 交付                                                                                             | 完成依据                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 0：版本修正（已完成）   | 移除 deploy/release-extension 中过期 pnpm 版本，统一读取根 packageManager                        | YAML 解析通过，所有 pnpm setup 均无独立版本覆盖                            |
| 1：单测入口与 Extension | Mobile Jest、Extension Vitest、必要的 Web 入口；Extension 标准 Playwright 套件；各自最小框架用例 | 干净安装后 Nx 能运行非零用例；故意破坏对应行为时测试失败；扩展加载真实产物 |
| 2：后端集成环境         | 隔离 infra、生命周期 helper、Engine/Pulse/Worker 框架测试                                        | 本地与 Linux CI 都走真实协议／持久化；故障断言有效；完成与失败均清理资源   |
| 3：Mobile 设备自动化    | 独立构建 profile、Maestro flows、两平台自动编排与报告                                            | Android/iOS 各完成无人操作的构建、安装、流程和清理；平台缺失不能算通过     |
| 4：CI/CD 与使用文档     | 按影响范围调度、汇总状态、失败报告、同一版本发布检查、复制示例指南                               | 实际 PR 检查能阻止故意失败的变更；发布演练失败时不执行发布；检查记录可追溯 |

每个阶段同时交付“怎样新增自己的测试”的文档、最小示例和预期输出。未配置第三方服务的新使用者，应能运行核心单测和本地框架集成测试；设备测试单独说明系统工具前置条件。不要只靠文件存在、配置解析或 mock 单测宣布真实 E2E 已完成。

## 参考资料

- [Expo 单测与 jest-expo](https://docs.expo.dev/develop/unit-testing/)
- [Expo Router 测试配置](https://docs.expo.dev/router/reference/testing/)
- [Expo 的 Maestro E2E 工作流](https://docs.expo.dev/eas/workflows/examples/e2e-tests/)
- [Maestro JavaScript 与沙箱环境](https://docs.maestro.dev/maestro-flows/javascript/javascript-overview)
- [Detox 的 RN E2E 方式](https://wix.github.io/Detox/docs/introduction/getting-started/)
- [WXT 的 Vitest 支持](https://wxt.dev/guide/essentials/unit-testing)
- [Playwright 的扩展测试](https://playwright.dev/docs/chrome-extensions)
- [仓库当前测试指南](../testing.md)
