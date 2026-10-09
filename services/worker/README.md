# worker

## 用途

Nest 后台 RabbitMQ 消费应用，提供版本化 handler registry、PG Inbox 幂等、重试/DLQ 与健康端点。`platform.smoke` 是用于演示和验证消息链路的处理器；新增业务在 registry 中显式注册。

## Tags、使用者与场景

`type:app` · `runtime:node` · `domain:composition`。

由 Engine/平台发布者经 RabbitMQ 提交信封；业务请求通过 Engine 或 Pulse 进入，Worker 不提供公网业务 API。

依赖同时受 type/runtime/domain 限制，详见[根目录规则](../../docs/architecture/ray-framework-nx-guide.md#公共入口与运行时)。仅通过已声明 public API 使用，不跨项目相对路径导入源码。

## 环境变量与配置来源

dev:worker 从根 .env 注入；app.module 组装 mongo/rabbitmq；main 读 WORKER_PORT（默认 3002）。平台队列与 handler 由代码契约决定，修改时同步生产者与消费者。

| 变量                                                                                  | 含义                                        | 何时配置/默认                            | 值从哪里来                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------- |
| `POSTGRES_DATABASE_URL`                                                               | Prisma/pg 连接串（含主机、库名与认证）      | 连接 PG 时必填                           | 管理员提供或由本地 POSTGRES_HOST/PORT/USER/PASSWORD/DB 组合 |
| `POSGTRES_DATABASE_URL`                                                               | 旧拼写，只有新变量未设时回退                | 仅兼容；不要新增依赖                     | 旧部署配置；非生产会告警                                    |
| `NODE_ENV`                                                                            | 运行模式 development/test/production        | 默认 development                         | 运行命令/部署环境                                           |
| `MONGO_HOST` / `MONGO_PORT`                                                           | Mongo 连接地址与端口                        | 连接时配置；本地默认 localhost/27017     | Mongo/Compose                                               |
| `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD` / `MONGO_INITDB_DATABASE` | Mongo 用户/密码/库名                        | 连接时配置；源码示例凭据不能投产         | Mongo 管理员；实际服务应使用最小权限账号                    |
| `RABBITMQ_URI`                                                                        | AMQP 连接串                                 | 队列连接需要；默认 amqp://localhost:5672 | RabbitMQ vhost/服务账户/网络地址                            |
| `RABBITMQ_EXCHANGE_NAME` / `RABBITMQ_EXCHANGE_TYPE`                                   | 业务 exchange 名与 direct/topic/fanout 类型 | 默认 core/direct                         | 消费/发布双方约定；平台 smoke 使用契约内固定 exchange       |
| `WORKER_CONCURRENCY`                                                                  | prefetchCount 并发控制输入                  | 默认/校验见 rabbitmq.module.ts           | 依据 Worker 容量配置，不等于 Nx parallel                    |

加载时机、dotenv wrapper 和秘密管理见[环境指南](../../docs/development/environment.md)。本表未包含真实凭据。

## 运行与构建

所有命令从仓库根执行：

```sh
pnpm nx show project worker --json
pnpm dev:worker
pnpm nx run worker:build
pnpm nx run worker:lint
pnpm nx run worker:typecheck
```

## 单元测试：运行与编写

```sh
pnpm nx run worker:test --run
```

参考 platform-event.consumer.spec.ts 和 registry spec；mock Inbox/Amqp/handler，覆盖幂等、重试次数、DLQ、未知版本，注入随机源验证退避，不实际 sleep。

现有用例示例：[src/app/platform-event.consumer.spec.ts](src/app/platform-event.consumer.spec.ts)、[src/app/platform-handler.registry.spec.ts](src/app/platform-handler.registry.spec.ts)。

新增用例放项目 `src` 内，按配置 include 使用 `*.spec.ts`/`*.spec.tsx`；先看 [测试指南](../../docs/development/testing.md) 的环境、mock 与非零用例要求。

## 集成与 E2E：运行与编写

```sh
pnpm nx run worker:test-integration
pnpm nx run worker:e2e
```

真实 RabbitMQ/PG 套件验证 Inbox 完成、重复投递、长租约不阻塞短 TTL 重试、最后一次失败与 DLQ、活动租约重投，以及杀进程后重启恢复；集成套件覆盖并发认领、租约恢复与旧处理者的写入限制。外部业务副作用仍需幂等键和自己的业务用例。

需要可运行 Linux 容器的 Docker / Compose v2。入口自动创建本机隔离环境、迁移和测试数据，完成后保存日志并清理；不会读取开发 `.env` 或连接外部数据库。用例放在 `tests/*.integration.spec.ts` / `tests/*.e2e.spec.ts`，不能直接运行内部 runner 指向开发库。

报告位于 `dist/test-results/worker/<suite>/<run-id>/`。fixture、失败清理和新增用例说明见 [后端测试指南](../../docs/development/testing-backend.md)，实际结果见 [项目现状](../../docs/development/status.md)。
