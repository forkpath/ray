# 项目现状

本页只记录当前可用的能力、已知限制和对应的验收方式，供新成员快速判断。2026-09 至 2026-10 的
实施、失败与修复过程保留在 [归档](archive/) 中，不再更新。

## 已就绪

| 能力          | 状态与入口                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 本地启动      | `pnpm bootstrap --seed --start` 一条命令完成配置、安装、基础设施、迁移、演示数据与四个应用；`pnpm run doctor` 诊断。见 [本地启动](bootstrap.md)         |
| 质量门禁      | 全仓 `nx format:check`、零 warning lint、typecheck、带覆盖率门槛的单测；CI 按 affected 选择并强制执行。见 [CI 检查](testing-ci.md)                      |
| 分层约束      | Engine/Pulse 的 Domain 与 Application 层禁止导入数据库、SDK 和 infrastructure，由 ESLint 拦截。见 [框架指南](../architecture/ray-framework-nx-guide.md) |
| 业务资源生成  | `nx g @ray/plugin:resource` 生成 Prisma 到 API client 的全部后端分层与测试。见 [生成器](../../tools/ray-plugin/README.md)                               |
| 后端集成测试  | Testcontainers 启动真实 PG/Redis/Mongo/RabbitMQ，失败与中断也会清理。见 [后端测试](testing-backend.md)                                                  |
| 分支与发布    | dev/arch 只能经 PR 修改，dev 部署 staging；main 只能快进到已部署 staging 的 dev 提交，部署 production。见 [分支维护](branch-workflow.md)                |
| 自托管 Runner | Mobile 与 Desktop 客户端测试可通过仓库变量切到自有 Mac/Windows，默认仍用托管 runner。见 [自托管 Runner](self-hosted-runners.md)                         |
| 依赖安全      | 官方 registry 审计；本地补丁必须有期限和回归测试；`pnpm ci:patches` 报告补丁的上游新版本。见 [依赖治理](dependency-governance.md)                       |

## 已知限制

- **部署**：staging 的 Kong 网关、公网 HTTPS 和 production 部署尚未完成验收。步骤见
  [GitHub 部署配置](github-deployment-setup.md)。
- **安全补丁期限**：`.github/security-mitigations.json` 中的补丁豁免到期后，审计会按未修复处理并阻断 CI。
  到期前需升级上游版本或重新评审，可用 `pnpm ci:patches` 查看上游是否已有新版本。
- **启动平台**：Intel macOS 有完整计时验收；Linux 由 CI 的 `bootstrap` 任务在启动相关文件变更及全量运行时验收；
  Apple Silicon macOS 与 Windows 尚未验收。
- **生成器不生成 UI**：资源生成器只生成后端和 API client。页面需手写，可参考
  `libs/studio/src/modules/admin` 的列表（`useDataTable`）与表单，以及 `apps/web/src/routes/_app/admin` 的路由。
- **专项验收**：macOS 签名升级、真机硬件、商店发布、真实第三方账户与 Firefox 扩展加载需在使用这些能力的项目中单独验收。

## 如何复核

```sh
pnpm run doctor
pnpm nx run-many -t lint,typecheck,test --all
pnpm ci:checks
pnpm ci:patches
```

后端真实集成测试需要 Docker：`pnpm nx run-many -t test-integration,e2e -p engine,pulse,worker`。
本地通过不能替代远端 CI；CI 结果以对应提交的 `Required checks` 为准。
