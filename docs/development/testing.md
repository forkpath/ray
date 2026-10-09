# 测试开发指南

Ray 的测试设施面向可复用开发框架：维护者提供测试入口、隔离环境、fixture、报告和验证框架能力的用例；业务开发者编写自己的领域规则与业务流程测试。已有业务示例不等于所有使用者都必须运行的框架检查。各运行时的工具选择见下文；当时的选型与分阶段验收过程见 [归档方案](archive/2026-09-testing-framework-plan.md)。

## 按运行时选择工具

| 运行时                             | 单元／组件测试                                  | 集成／端到端测试                                     |
| ---------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Mobile 的 RN 组件、Expo 模块、路由 | Jest + jest-expo + React Native Testing Library | Maestro 驱动 Android Emulator / iOS Simulator        |
| 与平台无关的 TypeScript 库         | Vitest                                          | 按公开契约补必要集成测试                             |
| Web、Extension 的 React DOM 组件   | Vitest + React Testing Library                  | Playwright；扩展加载真实扩展产物                     |
| Desktop main / renderer            | Vitest，分别使用 Node / DOM 环境                | Electron E2E、打包运行和升级验证                     |
| Engine / Pulse / Worker            | Vitest，按需使用 Nest TestingModule             | Vitest + 真实 HTTP / ws / RabbitMQ 与 Testcontainers |

## 选择测试入口

通过 Nx 执行项目测试。先查看目标配置，确认项目实际提供的任务与测试文件：

```sh
pnpm nx show project engine --json
pnpm nx run engine:test
pnpm nx run-many -t lint,typecheck,test -p engine,pulse,worker
```

根 `vitest.config.ts` 发现 apps/libs/services 下的专用 Vitest 配置，便于编辑器和聚合运行。配置文件不会自动创建用例；`run-many` 跳过缺失 target 也不表示该项目已被测试。

## 编写行为测试

在项目配置的 include 范围内添加 `*.spec.ts` / `*.spec.tsx`。优先覆盖公共 API 的正常行为、拒绝条件、异常与重复调用。数据库/SDK/网络使用替身时，测试结论只涉及该层逻辑。

Node 代码使用 Node 环境，Web 组件使用 jsdom 与 Testing Library。读取环境的模块先设置测试变量，再动态导入；测试结束恢复环境和 mock。测试不使用真实生产凭据。

参考 [事件契约](../../libs/platform-contract/src/lib/platform-contract.spec.ts)、[Billing API](../../libs/api-client/src/domains/__tests__/billing.spec.ts)、[Billing Use Case](../../services/engine/src/application/use-cases/billing/__tests__/billing-use-cases.spec.ts)。

## 没有 test target 怎么办

按运行时选择配置：Node/Web 和平台无关 TypeScript 可复用 Vitest；真正渲染 React Native 组件或依赖 Expo 测试适配的套件优先使用 Jest + jest-expo。补齐 alias、环境与用例收集范围，再添加实际行为用例。用 `nx show project` 确认目标存在并运行非零用例；不要用 `passWithNoTests` 表示已有覆盖。

Electron main 与 renderer 需要不同环境；Native SDK 需要平台专用替身。桌面测试与打包验证入口见 [Desktop README](../../apps/desktop/README.md)。

## 数据库集成

在独立空数据库中使用当前初始化迁移，验证部署可重复执行，并核对数据库与模型：

```sh
# .env.local-test 只配置独立的测试数据库
pnpm exec dotenv -e .env.local-test -- pnpm nx run pg-dao:init
pnpm exec dotenv -e .env.local-test -- pnpm nx run pg-dao:deploy
pnpm exec dotenv -e .env.local-test -- pnpm nx run pg-dao:prisma -- migrate diff --from-config-datasource --to-schema=./src --exit-code
```

业务集成测试还应验证外键、唯一性、所有者约束、事务与授权。Prisma 无法表达的 CHECK 位于初始化 SQL 中，模型 diff 不替代这些约束的实际写入测试。

## Web 与服务集成

```sh
pnpm exec playwright install chromium firefox webkit
pnpm nx run web:build
pnpm nx run web-e2e:e2e
```

未设置 `BASE_URL` 时 Playwright 启动构建好的 Web 服务，默认端口 4173；它不会启动 Engine 或初始化数据库。设置 `BASE_URL` 可验证指定环境，其他配置见 [Web E2E](../../apps/web-e2e/README.md)。需要凭据的场景被跳过时，应报告为未验证。

- Pulse：认证 WebSocket 探针见 [release 脚本](../../scripts/release/README.md)，通过 Kong `/ws` 验证；授权、过期会话、多实例与断连恢复另写业务集成场景。
- Worker：用独立 RabbitMQ/PostgreSQL 测投递、Inbox 去重、重试与死信；健康响应只能证明就绪状态。
- Mobile：设备上的权限、深链和支付应在模拟器/真机验证；Expo export 仅验证打包。
- Extension：使用实际扩展产物验证 background/content/popup 与权限，普通 Web 页面测试不能替代。

## 框架维护检查

`pnpm ci:checks` 保留两组有明确保护目标的测试：

| 测试                          | 验证什么                                                    | 为什么保留                       |
| ----------------------------- | ----------------------------------------------------------- | -------------------------------- |
| `clean.test.mjs`              | 在临时 Git 仓库检查预览、已跟踪文件保护、符号链接和产物清理 | 防止维护命令误删源码或仓库外文件 |
| `runtime-boundaries.test.mjs` | 实际执行 ESLint、浏览器打包和 Native 环境读取检查           | 防止运行时边界规则失效           |

它们不参与新项目初始化，也不要求给每个包装脚本单独写测试。容器解析检查、真实启动、第三方沙箱测试分别报告，不以其中一项代替其他项。

## Mobile、Extension、Web 单元测试

```sh
pnpm nx run-many -t test,typecheck-tests -p mobile,extension,web
pnpm nx run mobile:test -- --watch
pnpm nx run extension:test -- --watch
```

默认 `test` 执行完退出，零用例或断言失败返回非零。`typecheck-tests` 单独检查用例与 fixture 的类型；应用编译不加载 Jest globals。单测无需根 `.env`、生产账户或运行中的后端。JUnit 位于 `dist/test-results/<project>/unit/junit.xml`，按需传 `--coverage` 时覆盖率位于 `coverage/apps/<project>`。

- Mobile：在 `apps/mobile/tests` 新增 `*.spec.ts(x)`，使用与 Expo 57 匹配的 `jest-expo`、RN preset 和 Testing Library。v14 的 `render`、`renderHook`、交互必须 `await`。参考 `settings-tile.spec.tsx` 的真实原生按钮、`copy-to-clipboard.spec.ts` 的原生适配器正反例，以及 `router.spec.tsx` 的测试路由与深链接参数。测试路由不放入 `src/app`。
- Extension：在 `apps/extension/tests` 新增 `*.spec.ts(x)`。官方 WXT fake browser 每例重置；测试实际存储封装、消息分发和错误边界。WXT 0.20 的 `WxtVitest` 即使禁用配置文件仍调用 dotenv，因此独立测试配置直接使用其 fake browser 并禁用环境文件读取。浏览器替身不能证明扩展权限或真实注入能力。
- Web：在 `apps/web/src` 与被测模块相邻添加 `*.spec.ts(x)`。专用 Vitest 配置不加载 TanStack Start/Nitro 的生产构建插件。参考身份同步 Provider 和定时器生命周期的用例。

Jest 与 Vitest 的用例使用各自入口，根 Vitest 不收集 Mobile Jest 或 Playwright 文件。不同套件可共享普通测试数据；原生 mock、DOM fixture 不混入公共运行时代码。

## 覆盖率与新增 Web 示例

CI 按 affected 项目执行 Vitest 覆盖率门槛，包含未被测试导入的源码。
本地运行、统计范围、起步基线与缓存规则见 [覆盖率指南](testing-coverage.md)。
`ui-web:test` 提供按钮、复选框、对话框交互样板；Web 的 `src/__tests__/routing.spec.ts`
覆盖正式路由的匿名跳转、平台管理员权限和会话服务失败。

## Extension 真实浏览器测试

```sh
pnpm exec playwright install chromium
pnpm nx run extension:e2e
# 兼容旧命令：构建并验证生产配置的 Chrome 产物
pnpm nx run extension:smoke
```

`extension:e2e` 自动构建 `build-e2e/chrome-mv3-e2e`，使用固定本地地址并关闭可选监控/分析提供商，每个用例创建并清理独立 Chromium profile。它验证五个扩展页面的 background messaging、重新加载、真实 storage，以及 content script 的交互。只替换外部 HTTP 认证响应，不替换扩展消息或 storage。测试构建没有认证绕过，与正式产物目录隔离。

在 `apps/extension/e2e` 添加用例并从 `./fixtures` 导入 `test` 和 `expect`。fixture 提供真实 `context`、`page`、`extensionId`，自动收集页面错误、trace、失败截图并关闭浏览器、删除 profile。报告位于 `dist/test-results/extension/e2e`；查看 HTML 报告可用 `pnpm exec playwright show-report dist/test-results/extension/e2e/html`。Firefox 的构建检查不等于 Firefox 扩展运行验收。

# 后端真实依赖测试

Engine、Pulse、Worker 提供独立的 `test-integration` 与 `e2e` 入口，自动创建和清理一次性数据库及消息环境。运行方式、数据 fixture、报告目录和新增用例说明见 [后端框架测试指南](testing-backend.md)。当前通过情况与限制见 [项目现状](status.md)。

Mobile 原生设备的固定工具、隔离测试构建和 Maestro 流程见 [设备测试指南](testing-mobile.md)。

PR 调度、必需检查、发布产物验证及部署探针见 [测试与发布门禁](testing-ci.md)。
