# Ray 框架与依赖边界

Ray 是跨端业务开发脚手架。应用负责组合能力，共享库提供可测试的契约与实现，基础设施通过明确入口接入。

## 运行架构

Kong 是统一入口：`/api`、`/api/auth` 进入 Engine，`/ws` 进入 Pulse，其余路径进入 Web。Worker 消费 RabbitMQ 消息，其健康端口只用于内网探针。详见 [部署指南](deployment.md)。

| 层     | 职责                                       | 主要位置                                                            |
| ------ | ------------------------------------------ | ------------------------------------------------------------------- |
| 应用   | 页面路由、进程启动、能力组合               | `apps/*`、`services/*`                                              |
| 契约   | 通用类型、请求响应校验、事件信封           | `auth-contract`、`billing-contract`、`payload`、`platform-contract` |
| 客户端 | HTTP/认证/支付的端适配                     | `api-client`、`auth-client-*`、`billing-client-*`                   |
| 服务端 | Use Case、领域规则、持久化与基础设施适配   | `services/engine/src`、`*-server`、`server-*`                       |
| 数据   | PostgreSQL 模型、Mongo 模型                | `pg-dao`、`mongo-dao`                                               |
| 界面   | 通用 tokens、Web/Native 组件、共享业务页面 | `ui-core`、`ui-web`、`ui-native`、`studio`                          |

新增业务按数据库/领域、契约、Use Case、基础设施、控制器、客户端的顺序实现。业务读写经过 Use Case；数据归属来自认证会话中的 `userId` 和组织上下文，不能相信客户端自己声明的所有者。

## 公共入口与运行时

跨项目仅导入公开入口；禁止相对路径穿透其他项目源码。`eslint.config.mjs` 用 Nx 标签约束依赖，三个维度共同生效：

| 标签        | 回答的问题         | 示例                                         |
| ----------- | ------------------ | -------------------------------------------- |
| `type:*`    | 代码承担哪一层职责 | contract、data-access、platform、ui、app     |
| `runtime:*` | 可以在哪个环境运行 | universal、web、native、node                 |
| `domain:*`  | 属于哪个领域       | auth、billing、platform、shared、composition |

Web/Native 不得导入 Node 实现；契约不能依赖数据库。`email` 是通用契约，模板渲染与投递在 `email-server`。`analytics`、`monitoring` 是不读取环境的核心，具体实现与环境读取分别放在 `-web`、`-native`、`-server`。

项目内部导入：apps 与 services 中，同目录及子目录用 `./`，其余一律用项目别名 `~/`（指向 `<项目>/src/*`），
`../` 由 `noParentRelativeImports()` 规则拒绝，`src` 外的图片、JSON 等静态资源除外。libs 保持相对路径：Nx 会拒绝库通过别名导入自身，
且库源码由各应用打包，库内别名会与应用别名冲突。新增应用或服务时，在 tsconfig 的 `paths`、测试配置和构建配置中加入 `~/*`，
并在 `eslint.config.mjs` 追加 `...noParentRelativeImports()`。该规则只检查 TS/TSX 文件中的 import/export 语句；动态 `import()`、`require()` 和 `vi.mock`/`jest.mock` 的路径字符串不在检查范围，同样应使用 `~/`，需在评审时留意。
Prettier 只负责把 `~/` 导入排在 `@libs/*` 之后，不改写路径。

标签约束代码依赖，不代替服务端权限验证。实际 ESLint、浏览器打包与 Expo 配置语法检查见 [边界检查](../development/boundary-checks.md)。

服务内部的分层由根配置导出的 `cleanArchitectureBoundaries()` 约束，Engine 与 Pulse 已启用：
`domain/` 不得导入 Nest、数据库、SDK 及其他层；`application/` 不得导入 `@libs/pg-dao`、`@libs/mongo-dao`、
Prisma、Mongoose、Redis、RabbitMQ、Stripe、AWS SDK，以及 `infrastructure/`、`presentation/` 下的代码（`~/` 别名和相对路径都会检查）。
Application 需要外部能力时，在 `domain/repositories` 或 `domain/ports` 声明接口与注入 token，在 `infrastructure/` 实现，
由 `presentation/` 的 Nest 模块绑定。新服务在自己的 `eslint.config.mjs` 中追加 `...cleanArchitectureBoundaries()` 即可启用。

## 可选能力

框架能力通过公共 API 显式注册。没有当前应用消费者的适配器仍可作为业务扩展点；默认启动不要求开通每一个提供商。

| 能力     | 入口                                                     | 接入要求                                |
| -------- | -------------------------------------------------------- | --------------------------------------- |
| 搜索     | `server-elasticsearch`                                   | 注册模块，配置索引与服务地址            |
| 短信     | `server-sms`                                             | 注册模块，配置供应商、签名与模板        |
| 邮件     | `email-server`、`server-email`                           | 选择发送提供商；Nest 可使用注入桥       |
| 对象存储 | `server-storage`                                         | 显式选择 S3 或 OSS，配置 bucket 与权限  |
| 计费     | `billing-contract`、`billing-client-*`、`billing-server` | Web 使用 Stripe，Native 使用 RevenueCat |

云提供商的凭据和真实集成测试由使用该能力的项目配置。S3 签名 PUT URL 和 OSS POST 表单策略具有不同上传语义，不能把适配器看成所有厂商行为完全一致。

## Nx 的职责

Nx 管理项目依赖、任务顺序、受影响项目和缓存。底层编译器、测试工具仍由对应 target 调用。

```sh
pnpm nx show projects
pnpm nx show project engine --json
pnpm nx graph
pnpm nx run engine:test
pnpm nx affected -t lint,typecheck,test,build
pnpm nx run-many -t package -p engine,pulse,worker
```

`project.json`、插件推导和 `nx.json` 合并后才是实际任务配置。服务端 `package` 依赖 `build`；Webpack 的 Nx 插件同时生成运行时 `package.json` 和裁剪后的 `pnpm-lock.yaml`，供 Docker 镜像安装生产依赖。

构建输入包括代码、依赖、工具配置和影响产物的环境变量；输出声明决定缓存恢复哪些文件。数据库写入、签名、发布、安装依赖等有副作用的任务禁止缓存。修改这些配置后运行 `pnpm ci:nx-cache-contracts`。

## CI 与发布

`.github/workflows/ci.yml` 在 PR/dev 上运行 affected 检查，在版本 tag、每周定时、手动或无法确定基线时运行全量检查。官方源安全扫描纳入必需检查。独立数据库任务在临时 PostgreSQL 中初始化并核对模型。测试范围和运行方式见 [测试指南](../development/testing.md)。

GitHub Actions 启动 runner，Nx 负责任务调度；配置 Nx Cloud 后可以共享远程缓存。包下载缓存、Nx 任务缓存、Docker 层缓存各自独立。

dev CI 成功后自动调用 `deploy.yml`，验证镜像并部署 staging；main 推送复用同一提交已部署成功的 digest，先执行迁移，再启动服务和 Kong。生产不重复完整 CI，但保留提交、产物和最新安全检查。详细环境与推广命令见 [部署指南](deployment.md)。桌面打包与签名使用独立工作流，见 [Desktop](../../apps/desktop/README.md)。

## 新项目的数据库与维护入口

从根 README 配置环境后执行一次 `pnpm db:init`，即可生成 Client 并创建当前完整结构。业务开发者修改模型时使用标准 Prisma 迁移；不需要执行框架研发期间的数据修补步骤。

[scripts](../../scripts/README.md) 提供持续使用的维护命令；[tools](../../tools/README.md) 仅隔离认证生成器和迁移 CLI 的依赖。开发 Agent 的共享规范见 [Agent 指南](../development/agents.md)。
