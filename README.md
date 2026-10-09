# Ray · 跨端 SaaS 开发脚手架

Ray 是基于 Nx 的 monorepo。Web、Electron、Expo 和浏览器扩展共用契约与适配库；Kong 统一承接 HTTP 与 WebSocket 流量，Engine 处理 API，Pulse 处理实时连接，Worker 在内网消费 RabbitMQ 任务。

## 开始使用

需要 Node 24、根 `package.json` 的 `packageManager` 指定版本的 pnpm，以及已启动的本机 Docker。

```sh
pnpm bootstrap --seed --start
```

命令检查工具版本，保留已有 `.env`，或从 example 创建权限为 0600 的本地配置与随机密码；冻结安装依赖，启动开发基础设施，执行 `db:init`。`--seed` 明确选择创建演示账号和组织；`--start` 随后通过 Nx 启动 Web、Engine、Pulse、Worker，并检查实际就绪状态。

新配置的普通账号是 `developer+user@example.test`，管理员账号是 `developer+admin@example.test`，密码读取本地 `.env` 的 `SEED_PASSWORD`，不会打印在日志中。已有配置须提供 `SEED_EMAIL`/`SEED_PASSWORD`；不需要演示数据时省略 `--seed`。

后续开发和诊断：

```sh
pnpm dev
pnpm run doctor --running
```

访问启动输出中的地址，默认 **http://localhost:8080**；端口已占用时，新配置会选择空闲端口。Kong 将 `/api` 转到 Engine、`/ws` 转到 Pulse、其余页面转到 Web。Ctrl-C 停止本轮应用进程，开发数据保留；`pnpm docker:dev:down` 停止基础服务且保留数据卷。

邮件、OAuth、支付仍需配置对应提供商。真机调试、自定义远端基础设施及分步命令见 [本地启动指南](docs/development/bootstrap.md)；bootstrap 的自动初始化只接受本机数据库。

## 仓库结构

| 路径                             | 职责                                         |
| -------------------------------- | -------------------------------------------- |
| [apps](apps/README.md)           | Web、Desktop、Mobile、Extension 与浏览器 E2E |
| [services](services/README.md)   | Engine、Pulse、Worker                        |
| [libs](libs/README.md)           | 共享契约、领域实现、运行时适配器与 UI        |
| [docker](docker/README.md)       | 开发基础设施、Kong 路由、服务镜像与部署编排  |
| [scripts](scripts/README.md)     | 清理、认证模型检查、CI 与发布入口            |
| [tools](tools/README.md)         | 固定依赖的执行工具与本地 Nx 业务生成器       |
| [.agents/skills](.agents/skills) | Codex/Cursor 共用开发规范                    |

## 开发入口

- [项目现状与已知限制](docs/development/status.md)
- [框架与依赖边界](docs/architecture/ray-framework-nx-guide.md)
- [环境变量](docs/development/environment.md)
- [本地启动与诊断](docs/development/bootstrap.md)
- [一条命令生成完整业务资源](tools/ray-plugin/README.md)
- [数据库模型与日常命令](libs/pg-dao/README.md)
- [认证与授权](docs/architecture/authentication-and-authorized.md)
- [组织上下文](docs/architecture/workspace-switching.md)
- [测试](docs/development/testing.md)
- [依赖维护与安全检查](docs/development/dependency-governance.md)
- [Kong 与容器部署](docs/architecture/deployment.md)
- [GitHub 部署配置清单](docs/development/github-deployment-setup.md)
- [使用开发 Agent](docs/development/agents.md)

## 常用命令

```sh
pnpm nx show projects
pnpm nx show project engine --json
pnpm nx graph
pnpm ci:affected
pnpm clean:dry-run
```

任务通过 Nx 执行，依赖与环境变化计入缓存。数据库写入、发布和外部副作用不缓存。应用通过各库公开入口导入代码，Web/Native 不导入 Node 运行时实现。详细规则见框架指南与 AGENTS.md。
