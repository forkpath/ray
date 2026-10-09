# engine

## 用途

Nest HTTP API 组合根：认证接入、用户/组织管理、计费、存储；采用 controller → command/query → use case → domain repository → infrastructure 分层。

## Tags、使用者与场景

`type:app` · `runtime:node` · `domain:composition`。

Web/Desktop/Mobile/Extension 经 API 调用；其他库不导入 Engine app 源码。

依赖同时受 type/runtime/domain 限制，详见[根目录规则](../../docs/architecture/ray-framework-nx-guide.md#公共入口与运行时)。仅通过已声明 public API 使用，不跨项目相对路径导入源码。

## 环境变量与配置来源

dev:engine 从根 .env 注入，ConfigModule 使用 server-nest AppConfig，auth/PG/Billing 在 import 时读取。instrument.ts 直接读 SENTRY_DSN（项目 DSN）与 SENTRY_ENVIRONMENT（默认 development），来自 Sentry 后台/部署环境。只启动启用的基础设施；当前 AppModule 已接 PG/Redis/Mongo/RabbitMQ。

| 变量                                                                                     | 含义                                                 | 何时配置/默认                                               | 值从哪里来                                                  |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- |
| `ENGINE_PORT` / `CORS_ORIGINS`                                                           | Engine 监听端口/允许跨域来源                         | AppConfig 默认 6006/\*；本仓库 dev 示例为 8000              | 服务拓扑；生产限制明确的受信 origin                         |
| `LOGGER_LEVEL` / `LOGGER_SCOPE`                                                          | 日志等级与 scope                                     | 默认 info/neo                                               | 运维日志策略                                                |
| `LOGGER_FILE_ENABLED` / `LOGGER_FILE_COMPRESS`                                           | 文件日志/压缩开关                                    | 当前 AppConfig 直接调用 toLowerCase；应显式设 true 或 false | 本地/部署配置，不应省略                                     |
| `LOGGER_FILE_SIZE_LIMIT` / `LOGGER_FILE_EXPIRED_IN`                                      | 轮转文件大小与保留周期                               | 默认 20M/14d                                                | 日志存储/审计策略                                           |
| `DEFAULT_LOCALE` / `LOCALE_PATH`                                                         | 服务端语言回退/翻译文件路径                          | 默认 en 和 libs/i18n/src/translations                       | 产品语言策略；容器中应指向实际复制路径                      |
| `NODE_ENV`                                                                               | 日志等运行模式                                       | 开发用 development，测试 test                               | 启动环境                                                    |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`                                           | Redis 连接                                           | 使用 Redis 时配置；本地默认 localhost/6379/空密码           | Redis 实例/Compose 网络配置                                 |
| `CACHE_TTL` / `CACHE_DB_INDEX`                                                           | 缓存 TTL（毫秒）与逻辑 DB                            | server-nest 默认两小时/0                                    | 应用缓存策略；示例 DB 为 1                                  |
| `THROTTLER_TTL` / `THROTTLER_LIMIT` / `THROTTLER_STORAGE` / `THROTTLER_DB_INDEX`         | 限流窗口（毫秒）、次数、memory 或 redis、逻辑 DB     | 按需要配置；默认 60000/10/memory/2                          | 流量容量策略，不能当用户权限校验                            |
| `MONGO_HOST` / `MONGO_PORT`                                                              | Mongo 连接地址与端口                                 | 连接时配置；本地默认 localhost/27017                        | Mongo/Compose                                               |
| `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD` / `MONGO_INITDB_DATABASE`    | Mongo 用户/密码/库名                                 | 连接时配置；源码示例凭据不能投产                            | Mongo 管理员；实际服务应使用最小权限账号                    |
| `RABBITMQ_URI`                                                                           | AMQP 连接串                                          | 队列连接需要；默认 amqp://localhost:5672                    | RabbitMQ vhost/服务账户/网络地址                            |
| `RABBITMQ_EXCHANGE_NAME` / `RABBITMQ_EXCHANGE_TYPE`                                      | 业务 exchange 名与 direct/topic/fanout 类型          | 默认 core/direct                                            | 消费/发布双方约定；平台 smoke 使用契约内固定 exchange       |
| `WORKER_CONCURRENCY`                                                                     | prefetchCount 并发控制输入                           | 默认/校验见 rabbitmq.module.ts                              | 依据 Worker 容量配置，不等于 Nx parallel                    |
| `POSTGRES_DATABASE_URL`                                                                  | Prisma/pg 连接串（含主机、库名与认证）               | 连接 PG 时必填                                              | 管理员提供或由本地 POSTGRES_HOST/PORT/USER/PASSWORD/DB 组合 |
| `POSGTRES_DATABASE_URL`                                                                  | 旧拼写，只有新变量未设时回退                         | 仅兼容；不要新增依赖                                        | 旧部署配置；非生产会告警                                    |
| `NODE_ENV`                                                                               | 运行模式 development/test/production                 | 默认 development                                            | 运行命令/部署环境                                           |
| `BETTER_AUTH_SECRET`                                                                     | 认证签名/加密密钥                                    | 必填，生产使用足够长的随机秘密                              | secret manager 生成，不能放客户端                           |
| `BETTER_AUTH_URL`                                                                        | 认证对外基础 URL                                     | 实际启动应显式填写合法 URL                                  | 部署域名及认证路由配置                                      |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                              | Google OAuth 应用 ID/密钥                            | 启用 Google 登录时配置                                      | Google Cloud OAuth 应用后台                                 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`                                              | GitHub OAuth 应用 ID/密钥                            | 启用 GitHub 登录时配置                                      | GitHub OAuth App 后台                                       |
| `AUTH_APPLE_CLIENT_ID` / `AUTH_APPLE_CLIENT_SECRET` / `AUTH_APPLE_APP_BUNDLE_IDENTIFIER` | Apple 服务/应用 ID、签名 client secret、Bundle ID    | 启用 Apple 登录时配置                                       | Apple Developer；secret 按 Apple 要求生成                   |
| `SEED_EMAIL` / `SEED_PASSWORD`                                                           | 初始化管理账户                                       | 仅 seed 时必填，密码至少 12 字符                            | 受控种子账户，不是普通登录用户输入                          |
| `NODE_ENV`                                                                               | 影响认证环境行为                                     | 默认 development                                            | 进程启动环境                                                |
| `STRIPE_SECRET_KEY`                                                                      | 创建 Stripe Checkout/Portal 的服务端 API key         | Stripe 路径需要                                             | Stripe Dashboard 测试/生产对应环境                          |
| `STRIPE_WEBHOOK_SECRET`                                                                  | 验证 Stripe webhook 签名                             | 接收 Stripe webhook 时需要                                  | 具体 Webhook endpoint 的 signing secret                     |
| `REVENUECAT_API_KEY`                                                                     | 拉取订阅快照的 REST key                              | 同步 RevenueCat 时需要                                      | RevenueCat 后台服务端 API keys                              |
| `REVENUECAT_WEBHOOK_SECRET`                                                              | 校验 Authorization header                            | 接收 RevenueCat webhook 时需要                              | 在 RevenueCat webhook 设置的秘密值                          |
| `ORGANIZATION_BILLING_ENABLED`                                                           | 启用组织 Stripe 计费                                 | 默认 false                                                  | 发布负责人，不能客户端自行开启                              |
| `STORAGE_ACCESS_KEY_ID` / `STORAGE_ACCESS_KEY_SECRET`                                    | 对象存储账号凭据                                     | 启用存储时必填                                              | AWS IAM/阿里云 RAM 最小权限账号                             |
| `STORAGE_BUCKET` / `STORAGE_REGION`                                                      | 存储桶和区域                                         | 启用时配置                                                  | 预先创建的 bucket                                           |
| `STORAGE_END_POINT`                                                                      | server-nest/现有 Engine 存储配置读取的 endpoint 拼写 | S3 兼容服务按需配置                                         | 存储服务完整 endpoint；不是通用自动别名                     |

依赖配置：[email-server](../../libs/email-server/README.md)、[billing-contract](../../libs/billing-contract/README.md)。只在实际启用对应路径时提供厂商配置，不把服务端密钥放到客户端。

加载时机、dotenv wrapper 和秘密管理见[环境指南](../../docs/development/environment.md)。本表未包含真实凭据。

## 运行与构建

所有命令从仓库根执行：

```sh
pnpm nx show project engine --json
pnpm dev:engine
pnpm nx run engine:build
pnpm nx run engine:lint
pnpm nx run engine:typecheck
```

## 单元测试：运行与编写

```sh
pnpm nx run engine:test --run
```

按 domain 纯规则、use-case mock repository、command/query mock、controller Session/DTO 拒绝分别测试；基础设施仓库 SQL 另做真实隔离 DB integration。

现有用例示例：[src/presentation/http/billing/billing.controller.spec.ts](src/presentation/http/billing/billing.controller.spec.ts)、[src/domain/entities/**tests**/organization.entity.spec.ts](src/domain/entities/__tests__/organization.entity.spec.ts)、[src/domain/entities/**tests**/customer.entity.spec.ts](src/domain/entities/__tests__/customer.entity.spec.ts)。

新增用例放项目 `src` 内，按配置 include 使用 `*.spec.ts`/`*.spec.tsx`；先看 [测试指南](../../docs/development/testing.md) 的环境、mock 与非零用例要求。

## 集成与 E2E：运行与编写

```sh
pnpm nx run engine:test-integration
pnpm nx run engine:e2e
```

真实 HTTP 套件使用完整 Engine 启动入口、隔离 PG/Redis/Mongo/RabbitMQ，验证真实登录、用户/组织授权、非法 DTO 与领域错误映射；集成套件验证 PG 约束和 Redis TTL/读写/删除。业务 API 前缀为 `/api/v1`，认证为 `/api/auth`。厂商 Webhook 和完整支付链路仍需项目自己的专项用例。

需要可运行 Linux 容器的 Docker / Compose v2。入口自动创建本机隔离环境、迁移和测试数据，完成后保存日志并清理；不会读取开发 `.env` 或连接外部数据库。用例放在 `tests/*.integration.spec.ts` / `tests/*.e2e.spec.ts`，不能直接运行内部 runner 指向开发库。

报告位于 `dist/test-results/engine/<suite>/<run-id>/`。fixture、失败清理和新增用例说明见 [后端测试指南](../../docs/development/testing-backend.md)，实际结果见 [项目现状](../../docs/development/status.md)。
