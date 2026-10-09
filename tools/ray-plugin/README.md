# Ray 业务资源生成器

在仓库根目录预览，然后去掉 `--dry-run` 执行同一条命令：

```sh
pnpm nx g @ray/plugin:resource reading-note --plural=reading-notes --ownership=user --dry-run --no-interactive
```

组织资源使用 `--ownership=organization`，例如：

```sh
pnpm nx g @ray/plugin:resource team-note --plural=team-notes --ownership=organization --dry-run --no-interactive
```

名称必须是单数 kebab-case，复数路由显式指定以支持 `category/categories` 等不规则形式。
生成器拒绝保留名称、路径穿越、已有模型、模块、路由和文件；不会覆盖已有资源。
相同输入和仓库状态生成相同内容。迁移序号是已有迁移最大时间戳的下一秒，不依赖执行时钟。

## 生成内容

这是包含 `title` 和可空 `description` 的可执行 CRUD 起点。请在此基础上扩展领域字段和业务规则。

| 层次            | 产物与约束                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------ |
| Prisma          | 独立 model、明确物理表名、归属与分页索引、离线 SQL migration                               |
| Domain          | 实体、实际用于创建/编辑的 Title 值对象、仓储接口、纯错误码；不依赖 Nest 或数据库           |
| Application     | 纯 Use Cases 执行授权、业务校验与编排；CQRS Handler 仅调用 Use Case                        |
| Infrastructure  | 真实 Prisma 仓储与访问策略；读、分页、总数、更新、删除均限定 owner                         |
| HTTP            | 自动注册 AppModule、DI、Zod DTO、Controller、错误映射；返回内层数据，由全局拦截器包装      |
| Contract/client | 公共 payload 导出、客户端输入/响应解析、React Query 工厂、按用户和归属隔离的查询键         |
| Tests           | 实体与 Use Case 单测、真实 Axios adapter 客户端测试、生产 Engine 装配的 HTTP/Postgres 测试 |

个人资源路径为 `/api/v1/reading-notes`。所有者只来自 Session；他人资源返回 404。
组织资源路径为 `/api/v1/organizations/:organizationId/team-notes`。
路径中的组织 ID 是选择器，Use Case 每次通过真实成员关系验证访问权：成员可读，owner/admin 可写；
平台 admin 不自动获得组织权限。请求体中的 `ownerId`、`userId`、`organizationId` 等未知字段返回 400。
列表只有有界的 `page/perPage` 参数，按 `createdAt DESC, id DESC` 稳定排序。

生成器不连接数据库、不读取 `.env`、不应用迁移，也不改写 Better Auth 的 `auth.prisma`。
业务表保存带索引的用户或组织 ID，没有对自动生成认证模型的 Prisma relation 或级联删除。
接入实际产品时，需要明确账号/组织删除后的业务数据保留与清理策略；不要假设删除身份会删除这些记录。
该起点不包含 UI 页面、全文搜索、文件、支付、Worker 消息或对并发编辑的乐观锁。
页面需要手写：列表可参考 `libs/studio/src/modules/admin` 中基于 `useDataTable` 与生成的 React Query 工厂的数据表，
Web 路由参考 `apps/web/src/routes/_app/admin`。

## 使用与验证

1. 审查生成的模型、SQL 和权限策略；按业务扩展实体和值对象。
2. 在已确认属于本项目的本地开发环境应用迁移并生成 Prisma client。`pnpm bootstrap` 会完成这些步骤；
   已配置环境也可分别执行 `pnpm db:generate`、`pnpm db:deploy`。
3. 执行相关项目检查及隔离 HTTP 验收：

```sh
pnpm nx run-many -t lint,typecheck,typecheck-tests,test -p engine,payload,api-client,ray-plugin
pnpm nx run engine:e2e
```

`engine:e2e` 使用 Testcontainers 创建随机端口、随机凭据的一次性数据库与基础服务，验证真实登录、
DTO、CRUD 持久化、分页总数和跨用户/跨组织隔离，并清理其容器、卷和网络。不会使用开发数据库。

客户端从当前认证 Session 构造 scope。查询和变更工厂接收 scope；更新只失效当前用户/组织的相关缓存。
在退出登录或切换组织前调用生成的 `clearReadingNoteScope(queryClient, previousScope)`（名称随资源变化），
先取消旧请求再移除旧范围缓存。新请求使用新 scope，不能把固定 `me` 当作缓存身份。

`ray.resources.json` 登记已生成资源。`ray-plugin:test` 检查这些资源的内部层次依赖，包括别名、barrel、
type import、动态 import 和 require；Domain/Use Case 不得依赖数据库、Nest 或具体仓储，Handler 不得直接访问数据库。
这项检查针对已生成资源，不表示历史模块已经全部迁移到新规则。

## 维护生成器

```sh
pnpm nx run ray-plugin:test
pnpm nx run ray-plugin:e2e
```

修改权限或 DTO 模板时，使用 `pnpm nx run ray-plugin:e2e:guards` 追加反向验证：仅在临时副本中移除
一个 DTO 校验和一个仓储 owner 条件，必须观察到对应的真实 HTTP 测试失败，然后恢复文件并清理环境。
常规 CI 执行正向验收，避免每次都重复启动用于反向验证的基础服务。

后者在临时源码副本中真正调用 Nx CLI，分别生成个人和组织资源，证明 dry-run 无源码修改、重复生成被拒绝，
再运行类型检查、零 warning lint、带覆盖率门槛的单测，以及真实 HTTP/Postgres 验收。
依赖安装作为输入复用，Nx 结果缓存与生成代码留在临时副本；报告保留在 `dist/test-results/ray-plugin/`。
CI 对生成器或其依赖受影响的 PR 执行此 Linux 任务，并将其纳入 `Required checks`。
