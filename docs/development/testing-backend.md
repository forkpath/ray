# 后端框架集成与 E2E 测试

使用 Node、pnpm 的仓库锁定版本，以及可运行 Linux 容器的 Docker（Testcontainers 12.2.0）。入口面向 Linux 和 macOS，不需要开发 `.env`、生产账号、邮件或监控服务凭据。

```sh
pnpm nx run engine:test-integration
pnpm nx run engine:e2e
pnpm nx run pulse:test-integration
pnpm nx run pulse:e2e
pnpm nx run worker:test-integration
pnpm nx run worker:e2e
```

常规单测继续使用 `<project>:test`；新增测试的类型检查使用 `<project>:typecheck-tests`。真实服务套件禁用 Nx 结果缓存。资源有限的开发机优先串行执行 E2E；CI 可以在独立 runner 上并行。

## 生命周期和数据边界

公共 target 调用 `scripts/testing/run-backend.mjs`。默认由 Testcontainers 创建独立网络、数据库、RabbitMQ vhost 和临时凭据。后端集成、协议 E2E 与发布镜像验证共用这个入口，不再维护测试 Compose 配置。容器端口仅绑定 `127.0.0.1`，由 Docker 分配空闲端口，不使用开发卷。

基础设施镜像和 Ryuk 使用固定 digest；这些公共镜像使用匿名 registry 配置，不读取开发者的 registry 凭据。发布镜像要求本机已存在，不允许拉取替换；报告核对运行容器的实际 image ID。容器不跨测试复用。

发布镜像验收还启动真实 Kong，使用受控部署模板、入口脚本与 DNS 顺序；首页、健康检查、
匿名 HTTP 会话和 WebSocket 拒绝都经过同一网关端口。`run.json` 的 `gatewayVerified`
必须为 true 才允许发布，仅应用自身端口可用的旧报告不能授权发布。

runner 只继承系统与工具环境，显式关闭 Nx/Vite/Nest 的环境文件加载。确认 Docker 返回本机端口后，构造数据库连接并通过 `pg-dao:init` 应用仓库迁移。不能传入外部数据库 URL；内部 `integration-run` / `e2e-run` target 也会检查运行标识与数据库命名，不能直接对开发库运行。

单模块集成测试只启动所需依赖。Engine 的完整应用测试启动 PG、Redis、Mongo、RabbitMQ；Worker 的完整应用测试保留 Mongo 和 RabbitMQ。不会通过删除可选框架集成或把数据库替换成内存实现来获得通过结果。

Engine E2E 在自己的环境中显式启用组织计费，只验证已有身份的只读摘要路径，
不调用 Stripe 或创建支付。生产默认仍关闭该可选能力。Web 的历史组织计费场景
另需配置 `E2E_ORGANIZATION_BILLING_ENABLED=true`，并在隔离服务启用对应能力。

测试、启动失败或正常中断后均收集日志并删除该次容器、网络和卷。runner 设置启动与执行截止时间，清理失败也返回失败。Ryuk 保持启用，作为异常退出时的额外清理机制；正常成功、失败和 SIGTERM 仍由 runner 显式删除并核验。机器断电不保证立即清理，可根据报告中的 `namespace` 与容器标签 `io.ray.test.run` 定位该次资源，不能清空整台机器的 Docker 数据。

## 如何增加自己的用例

- 在对应服务的 `tests/` 下增加 `*.integration.spec.ts` 或 `*.e2e.spec.ts`。单测仍放在 `src/`；套件使用不同收集规则，避免真实依赖测试混入快速单测。
- 数据用随机 ID 与 `.invalid` 邮箱。复用 `@libs/testing-server` 创建真实账号、组织；Engine 用真实 HTTP 登录拿到签名 cookie，Pulse 使用真实 Better Auth handler 创建持久化会话。业务 E2E 应增加自己的资源准备和归属断言。
- Engine 复用 `createEngineApplication()`，它与正式启动共享 AppModule、前缀、认证、请求解析、校验和错误映射。测试绑定随机本机端口，`afterAll` 关闭应用。
- Pulse 使用真实 `ws` 客户端。等待消息与关闭有明确截止时间；跨实例用例启动两个应用、经过 Redis 网络，不能把 publish 函数调用计数作为分发证明。
- Worker 用真实 RabbitMQ 投递，检查持久化 Inbox 和队列。可以只在测试装配中注册可控 handler。`worker-process.ts` 是测试专用子进程入口，用于实际崩溃恢复；它不进入服务正式构建。
- 新增测试必须断言公开行为和失败情况；缺少依赖、零用例、断言失败都应返回非零，不使用 `passWithNoTests` 或静默跳过掩盖问题。

仓储示例见 `services/engine/tests/repositories.integration.spec.ts`：真实 PG 上验证个人/组织客户、排序白名单、搜索参数化、关联计数和空页总数。HTTP 用例同时验证实际登录会话、管理员角色和非法 query 的 400 响应。

最小示例可参考 Engine 的身份约束和 HTTP 测试、Pulse 的组织授权与双实例分发、Worker 的并发认领与 broker 重试。它们使用框架已有身份、组织、platform smoke event，不创建虚构业务模型。

## 当前消息契约

Pulse 校验消息结构、以真实 session 身份检查组织成员关系，并在投递前检查会话与成员是否仍有效。客户端不能决定事件 actor。Drain 拒绝新连接并关闭已有连接，恢复流量后可以重新连接。

Worker 的 Inbox 以 consumer/message ID 去重。仍有租约的重投消息会先向 broker 确认一个延迟副本，再确认当前投递；已完成的重复消息直接忽略。认领次数同时作为完成/失败写入的条件，旧处理者不能覆盖新租约的状态。

延迟投递按 1、2、5、10、20、30、60、120、360 秒的固定 TTL 队列分组，
请求的抖动退避向上取最近档位，实际延迟写入 `x-retry-delay-ms`。同一队列
不再混放不同消息 TTL，避免短重试被长租约或长退避挡在队尾。计时由真实
RabbitMQ 执行，不依赖进程内定时器；仍等待 broker 确认延迟副本后再 ack。
原有 `platform.smoke.retry` 队列不会被自动删除，旧消息按原有 DLX 配置继续
返回工作队列；已有部署应确认排空后再移除旧队列。

默认租约为五分钟，消息语义仍是“至少一次”。Handler 必须对外部副作用使用业务幂等键；长任务需要明确拆分或扩展续租策略。Inbox 记录去重不等于支付、邮件等外部操作恰好执行一次。崩溃测试只调整测试记录的租约时间，真实进程和 RabbitMQ 时钟照常运行。

## 报告与验收

每次运行的结果位于：

```text
dist/test-results/<project>/<integration|e2e>/<run-id>/
  junit.xml
  runner.log
  infrastructure.log
  run.json
  process-<pid>.log       # Worker 进程恢复测试
```

`run.json` 分别记录测试是否通过、资源是否清理、中断状态及命名空间。CI 应始终上传整个报告目录，包括失败时的日志。断言通过但清理失败不是成功；本地通过也不能替代 Linux CI 记录。此前测试基线见 [测试框架验收记录](archive/2026-09-testing-framework-validation.md)，本轮迁移结果与剩余工作见 [优化过程记录](archive/2026-09-hardening-log.md)。

实现依据：[Testcontainers 容器与生命周期](https://node.testcontainers.org/features/containers/)。每个服务先通过健康与端口检查，宿主端口必须仅绑定 loopback；缺 Docker 或远程 Docker 不会跳过测试。

## 管理列表回归边界

| 资源与动作                      | 身份与权限                             | 查询范围                                                 | 拒绝结果                                    |
| ------------------------------- | -------------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| GET /api/v1/admin/customers     | 服务端 Better Auth Session，平台 admin | 平台管理列表，覆盖个人及组织客户；搜索和计数使用相同过滤 | 无会话 401，普通用户 403，非法排序/分页 400 |
| GET /api/v1/admin/organizations | 服务端 Better Auth Session，平台 admin | 平台管理列表；成员数过滤和分页总数保持一致               | 无会话 401，普通用户 403，非法排序/分页 400 |

这两条既有路径的权限和响应 envelope 保持不变。客户端和 DTO 共用允许的排序字段，
仓储用固定 SQL 片段映射字段，并把搜索、范围和分页值参数化。两个 CQRS Handler
现在调用独立 Use Case，由 Nest module 注入仓储接口。客户端查询 key 保持原有过滤项，
没有新增写操作或改变组织切换缓存规则。

客户列表的 `referenceId` 兼容字段由当前 `user_id` / `organization_id` 推导，
展示名称/图片分别来自对应 owner；不再读取数据库中已删除的 `reference_id`。
支持前端已有的 `user.name` 排序。相关样板同时检查多关联 join 的计数和超出末页时的总数。
