# 本机初始化与诊断

准备 Node 24（`.nvmrc`）、`packageManager` 指定的 pnpm 和已启动的本机 Docker。
命令本身只依赖 Node 内置模块，无需先安装工作区依赖。

```sh
pnpm bootstrap --seed --start
```

顺序为版本检查 → 创建或校验 `.env` → 冻结安装 → 开发 Compose 健康检查 →
`nx run pg-dao:init` → 可选 `nx run pg-dao:seed` → 可选四个应用的 Nx `serve`。
Web/Engine 通过 Kong、Pulse/Worker 的就绪端点均通过才输出全栈就绪时间。

诊断命令请保留 `run`：`pnpm doctor` 是 pnpm 自带的诊断命令，`pnpm run doctor`
才会执行本仓库的全栈环境检查。

| 命令                                       | 行为                                                    |
| ------------------------------------------ | ------------------------------------------------------- |
| `pnpm bootstrap`                           | 安装、基础服务、迁移；不创建演示身份、不持续运行应用    |
| `pnpm bootstrap --seed --start`            | 显式创建演示数据并持续运行四个应用                      |
| `pnpm bootstrap --isolated --seed --start` | 首次创建配置时全部使用空闲端口，适合第二个副本/worktree |
| `pnpm dev`                                 | 使用已准备的环境统一启动应用                            |
| `pnpm run doctor`                          | 只读检查工具、配置、依赖；任一必需项失败时非零退出      |
| `pnpm run doctor --running`                | 额外检查五个开发容器健康与四个应用 HTTP 就绪            |
| `pnpm docker:dev:down`                     | 停止开发基础设施，保留数据库卷                          |

## 配置与数据

没有 `.env` 时从 `.env.example` 创建；数据库密码、认证密钥和演示密码逐项随机生成，
文件以独占方式写入，权限 0600。常规端口占用时选择空闲端口，项目名、端口、密码
写入 `.env`，再次启动不会重新分配。既有 `.env` 原样保留；符号链接拒绝自动初始化。
`--isolated` 不修改已有配置。

bootstrap 不继承父 shell 的数据库/SaaS 配置，`${VARIABLE}` 只从同一文件展开。
自动入口要求根目录及应用/库目录没有额外的 dotenv 文件，避免 Nx 的任务配置覆盖
已校验的数据库地址；已有多层配置继续使用分步 `dev:*`。保留 Nx 的 dotenv 加载，
防止它卸载与根文件相同的注入值；开发服务启用 Nx daemon 以支持源码修改后重启。
三个后端服务的 development 构建只转译，避免启动时同时运行重复的 TypeScript 检查进程。
编辑期间可单独运行 `pnpm nx run-many -t typecheck -p engine,pulse,worker`；
生产构建保留类型检查，CI 也独立强制执行 affected 项目的 typecheck。
Postgres URL 的主机、用户名、密码、端口、库名必须与本机 Compose 配置一致；
Mongo、Redis、RabbitMQ 同样要求本机地址。外部数据库、远端 Docker 和生产环境
拒绝自动写入。失败/中断保留配置与数据，修正错误后重复运行即可。

新配置的 `SEED_EMAIL=developer@example.test` 对应普通用户
`developer+user@example.test`、平台管理员 `developer+admin@example.test` 和
`developer+org-owner@example.test` 等组织角色。密码读取 `.env` 的 `SEED_PASSWORD`。
seed 通过正式密码哈希创建已验证的开发身份，无需真实邮件服务；重复 seed 保留
既有凭据密码，更新演示组织和角色，不清空其他数据。修改 SEED_PASSWORD 不会重置
已存在账号。生产部署不会调用这些开发入口。

开发 Compose 使用公开镜像。bootstrap 为镜像拉取创建临时 Docker 客户端配置，保留
当前本机 daemon 和 Compose 插件路径，以匿名方式拉取，完成或失败后删除临时配置；
不会读取个人 registry 凭据或修改 Docker 登录。若匿名拉取触发 registry 限流，可先
用已登录的 Docker 执行 `pnpm docker:dev` 拉取镜像，再重新执行 bootstrap。
配置隔离机制参见 [Docker CLI 文档](https://docs.docker.com/reference/cli/docker/#configuration-files)。

## 分步与自定义环境

已有配置先运行 `pnpm run doctor`，替换 example 密码并保持 Web/API/Auth URL 与网关一致。
需要外部数据库或真机可访问的域名时，采用明确配置的分步入口：

```sh
pnpm install --frozen-lockfile
pnpm docker:dev
pnpm db:init
pnpm db:seed # 仅在需要演示数据且已设置 SEED_EMAIL/SEED_PASSWORD 时
pnpm dev:engine
pnpm dev:pulse
pnpm dev:worker
pnpm dev:web
```

这些分步命令采用开发者配置，bootstrap 的本机限制不改变它们的能力。真机需将公开
URL 改为开发机可访问地址。OAuth、邮件、支付、对象存储等仍需自己的提供商配置。
十分钟目标取决于机器、网络、pnpm 下载缓存和 Docker 镜像，实际耗时以输出为准，
不把依赖安装成功视为全栈验收。Intel macOS 有完整计时验收；Linux 由 CI 的 `bootstrap` 任务（`scripts/ci/bootstrap-acceptance.sh`）在启动相关文件变更和全量运行时，
从全新检出执行创建配置、启动全栈、`doctor --running`、重复运行不改写 `.env` 及中断退出。Apple Silicon macOS 与 Windows 尚未验收。

## 已验证的启动耗时

2026-09-30 对提交 `7ca79aa` 的 Intel macOS 验收使用 1941 个源码文件的独立副本，不带环境、依赖或
既有 Nx 构建结果；复用本机 pnpm 下载缓存和已下载 Docker 镜像。仅在验收副本中
将 Nx 的缓存目录固定到本地 `.nx/cache`，避免跨副本共享缓存影响计时。

- 冻结安装依赖：1 分 29 秒。
- 四个应用连续就绪：4 分 14 秒。
- 普通用户与管理员的浏览器登录、页面和退出验证完成：4 分 46 秒。
- 加上认证 WebSocket、重复 seed、环境文件保留和最终 doctor：5 分 13 秒，全部通过。

这是上述条件下的实测值；首次下载所有依赖/镜像和其他机器的时间不在这项结论中。
普通开发继续使用 Nx 默认缓存，无需修改缓存目录。详细发现和边界见
[优化过程记录](archive/2026-09-hardening-log.md)。
