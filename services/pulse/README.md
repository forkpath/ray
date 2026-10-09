# pulse

## 用途

Nest WebSocket 服务：Session/token 握手、组织成员校验、Redis 广播、心跳与限流/缓冲控制、readiness。只含平台 smoke 事件。

## Tags、使用者与场景

`type:app` · `runtime:node` · `domain:composition`。

受认证 WebSocket 客户端；同组织 room 访问仍须服务端 Member 校验，不能相信任意 organizationId。

依赖同时受 type/runtime/domain 限制，详见[根目录规则](../../docs/architecture/ray-framework-nx-guide.md#公共入口与运行时)。仅通过已声明 public API 使用，不跨项目相对路径导入源码。

## 环境变量与配置来源

dev:pulse 用根 .env。app.module 映射 REDIS_HOST/PORT/PASSWORD（Redis 实例，默认 localhost/6379/空）；main 读 PULSE_PORT → PORT → 3001。PLATFORM_SMOKE_ENABLED 仅精确 true 启用测试事件，应由测试负责人设定，生产默认 false。

| 变量                                                                                     | 含义                                              | 何时配置/默认                    | 值从哪里来                                                  |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| `POSTGRES_DATABASE_URL`                                                                  | Prisma/pg 连接串（含主机、库名与认证）            | 连接 PG 时必填                   | 管理员提供或由本地 POSTGRES_HOST/PORT/USER/PASSWORD/DB 组合 |
| `POSGTRES_DATABASE_URL`                                                                  | 旧拼写，只有新变量未设时回退                      | 仅兼容；不要新增依赖             | 旧部署配置；非生产会告警                                    |
| `NODE_ENV`                                                                               | 运行模式 development/test/production              | 默认 development                 | 运行命令/部署环境                                           |
| `BETTER_AUTH_SECRET`                                                                     | 认证签名/加密密钥                                 | 必填，生产使用足够长的随机秘密   | secret manager 生成，不能放客户端                           |
| `BETTER_AUTH_URL`                                                                        | 认证对外基础 URL                                  | 实际启动应显式填写合法 URL       | 部署域名及认证路由配置                                      |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                              | Google OAuth 应用 ID/密钥                         | 启用 Google 登录时配置           | Google Cloud OAuth 应用后台                                 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`                                              | GitHub OAuth 应用 ID/密钥                         | 启用 GitHub 登录时配置           | GitHub OAuth App 后台                                       |
| `AUTH_APPLE_CLIENT_ID` / `AUTH_APPLE_CLIENT_SECRET` / `AUTH_APPLE_APP_BUNDLE_IDENTIFIER` | Apple 服务/应用 ID、签名 client secret、Bundle ID | 启用 Apple 登录时配置            | Apple Developer；secret 按 Apple 要求生成                   |
| `SEED_EMAIL` / `SEED_PASSWORD`                                                           | 初始化管理账户                                    | 仅 seed 时必填，密码至少 12 字符 | 受控种子账户，不是普通登录用户输入                          |
| `NODE_ENV`                                                                               | 影响认证环境行为                                  | 默认 development                 | 进程启动环境                                                |

依赖配置：[email-server](../../libs/email-server/README.md)。只在实际启用对应路径时提供厂商配置，不把服务端密钥放到客户端。

加载时机、dotenv wrapper 和秘密管理见[环境指南](../../docs/development/environment.md)。本表未包含真实凭据。

### Pulse 自身连接配置

`REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD` 分别是实例主机、端口、密码，来自 Redis 管理员或隔离 Compose；本地默认 localhost/6379/空密码。这里只注册 Redis 连接，不要求 Engine 的 cache/throttler 配置。

## 运行与构建

所有命令从仓库根执行：

```sh
pnpm nx show project pulse --json
pnpm dev:pulse
pnpm nx run pulse:build
pnpm nx run pulse:lint
pnpm nx run pulse:typecheck
```

## 单元测试：运行与编写

```sh
pnpm nx run pulse:test --run
```

参考 pulse.gateway.spec.ts，mock auth/PG/Redis/socket，测未认证、成员资格、消息解析和缓冲边界；单进程 mock 不证明 Redis 多实例传播。

现有用例示例：[src/app/pulse.gateway.spec.ts](src/app/pulse.gateway.spec.ts)。

新增用例放项目 `src` 内，按配置 include 使用 `*.spec.ts`/`*.spec.tsx`；先看 [测试指南](../../docs/development/testing.md) 的环境、mock 与非零用例要求。

## 集成与 E2E：运行与编写

```sh
pnpm nx run pulse:test-integration
pnpm nx run pulse:e2e
```

真实 WebSocket 套件验证握手身份、协议拒绝、组织权限、双实例 Redis 分发、drain、成员移除与会话撤销；集成套件验证真实 Redis 数据与过期。无需生产账户，不能用单进程 mock 代替这些跨网络断言。

需要可运行 Linux 容器的 Docker / Compose v2。入口自动创建本机隔离环境、迁移和测试数据，完成后保存日志并清理；不会读取开发 `.env` 或连接外部数据库。用例放在 `tests/*.integration.spec.ts` / `tests/*.e2e.spec.ts`，不能直接运行内部 runner 指向开发库。

报告位于 `dist/test-results/pulse/<suite>/<run-id>/`。fixture、失败清理和新增用例说明见 [后端测试指南](../../docs/development/testing-backend.md)，实际结果见 [项目现状](../../docs/development/status.md)。
