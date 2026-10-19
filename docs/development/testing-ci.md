# 测试、CI 与发布门禁

CI 检查当前提交是否仍能安装、编译并满足框架行为契约；CD 在检查通过后使用
该提交构建的产物发布或部署。单测随开发运行并进入 PR，集成与 E2E 按影响范围
进入 PR 与 dev 推送，完整矩阵在首次建分支、每周定时、手动及显式发布验证时运行。

## 调度

`.github/workflows/ci.yml` 对所有 PR 触发，避免必需检查因路径过滤一直等待。
选择脚本使用 Nx 的受影响项目图，因此共享库变化会连带选择其消费者。
版本标签由 `Release Extension` 调用一次完整 CI，`ci.yml` 不再同时监听标签，
避免同一个发布提交重复运行两套移动设备与桌面矩阵。

面向 dev 和 arch 的 PR 只运行受影响的套件，并可用标签跳过设备 E2E；合入 dev 后的推送运行全量矩阵，
不读取标签。arch 的推送不运行 CI；main 不接受 PR，快进到已部署 staging 的 dev 提交后直接部署，不再运行 CI。

| 标签                | 作用（仅 PR 生效）               |
| ------------------- | -------------------------------- |
| `ci:skip-mobile`    | 跳过 Mobile Android/iOS 设备 E2E |
| `ci:skip-desktop`   | 跳过 Desktop 三平台检查          |
| `ci:skip-extension` | 跳过 Chromium 扩展 E2E           |
| `ci:full`           | 运行全量矩阵，优先于所有跳过标签 |

标签只跳过设备/E2E 套件，所有受影响项目的 lint、类型检查、单测和构建仍会执行。
修改标签后在该 PR 的运行上选择 **Re-run all jobs**（或推送新提交）生效。

| 套件                                      | PR 选择条件                      | dev 推送、定时、手动、发布验证      |
| ----------------------------------------- | -------------------------------- | ----------------------------------- |
| lint/typecheck/typecheck-tests/test/build | Nx affected                      | 全部                                |
| PG 迁移与 schema                          | 每次                             | 每次                                |
| Engine/Pulse/Worker 集成与 E2E            | 对应服务受影响                   | 三服务                              |
| Chromium 扩展                             | Extension 受影响                 | 执行                                |
| Web 正式构建页面                          | Web/web-e2e 受影响               | 三浏览器                            |
| Desktop                                   | Desktop 受影响                   | macOS 两架构、Windows、存储发布契约 |
| Mobile Android                            | Mobile 受影响                    | 执行                                |
| Mobile iOS                                | Mobile 受影响且原生依赖/配置变化 | 执行                                |
| Linux 全新检出启动验收                    | 启动相关脚本、依赖或迁移变化     | 执行                                |

Mobile Android/iOS 与 Desktop（macOS x64/arm64、Windows x64）默认在 GitHub 托管 runner 上执行；私有仓库可通过
仓库变量改在自有机器上运行，公开仓库不需要也不应启用。机器人和 fork 发起的运行不会使用自有机器，
已改到自有机器且托管镜像为 macOS 的任务在这些运行中默认跳过，见 [自托管 Runner](self-hosted-runners.md)。

测试编排、CI/发布脚本、Docker 配置、依赖补丁和 workflow 的变化选择完整 E2E 矩阵。
普通文档变化可不启动设备/后端套件。无法解析影响图时检查失败；找不到基线
提交时保守执行完整矩阵。所有 job 都固定到本次提交，设备与真实网络套件
不使用 Nx 结果缓存。Node/pnpm、Maestro、Java、Xcode、模拟器系统镜像及测试
容器版本按配置固定。Android emulator 使用 SDK 中已安装的版本并记录诊断；
硬件加速检查在原生构建前执行，设备行为仍需通过实际流程验证。

`Required checks` 必须成功：官方源安全扫描或基础检查失败、取消，或者应跑套件缺失/跳过，
都会返回失败。只有明确没有被选择的套件可以显示 skipped。
JUnit、trace、失败截图、构建/服务日志由各 job 的 `always()` 步骤上传。
Web 的历史厂商/业务账户场景不在默认框架页面套件中，不计作已通过。

## 仓库合并规则

dev、arch 的 ruleset 要求 `Required checks` 与 `PR policy`；main 要求 `Required checks` 与 `Staging verified` 状态（staging 部署成功后由 CI 写入），
只能由发布部署密钥快进更新。具体配置、合并方式与发布流程见
[分支维护](branch-workflow.md)。YAML 成功运行与 GitHub 实际阻止合并是两件事，不能
仅凭 job 名称宣称已经启用保护。

2026-09-29 历史验收已核实 `forkpath/postfly.io` 当时的默认分支 `arch` 和验收基线分支
`codex/testing-baseline-20260928` 均要求 `Required checks`、严格同步基线，
并对管理员生效。PR #1 临时转为 ready 后，失败检查使 GitHub 返回
`mergeStateStatus=BLOCKED`；验证后恢复 draft，未执行合并。此记录不等于新 dev/main
保护已生效；当前策略切换的实际读回与远端验证见 [优化过程记录](archive/2026-09-hardening-log.md)。

## 发布前后

- Extension：版本标签 → 同一 SHA 的完整 CI → 正式 Chrome/Firefox ZIP →
  解压 Chrome ZIP 并执行 `extension:e2e-artifact` → 发布原 ZIP、校验和与提交号。
  Firefox 当前只证明构建通过，未宣称实际扩展行为验收。
- 服务：dev 的 CI 必需检查通过 → 构建五个本地镜像 → 在独立 PG/Redis/Mongo/RabbitMQ 中运行
  migrator 与四个应用 → 启动真实 Kong 并通过网关检查页面、HTTP 会话/授权和 WS 授权 → 核对镜像
  ID 未变化后推送 → 按 registry digest 部署 staging → 公开 Kong 探针 → 成功部署记录。
  main 只推广同一 SHA 的五个已验证 digest；不同提交、失败/过期记录均拒绝，生产前仍做
  最新依赖扫描。分支推广、环境配置和构建变量边界见 [部署指南](../architecture/deployment.md)。
- 任何前置步骤失败，都不能进入后续发布步骤。发布命令还独立检查报告成功、
  清理完成、网关验收、提交号以及镜像 ID；不能把失败报告或后来替换的镜像拿去发布。
- 部署后探针不创建账户、不写业务数据，不要求生产测试密码。已有专用账号
  探针仍可显式启用。部署失败不自动撤销 schema；回退入口与备份要求见
  [部署指南](../architecture/deployment.md) 和 [发布脚本说明](../../scripts/release/README.md)。

本地可复现的入口：

```sh
pnpm ci:checks
pnpm ci:nx-cache-contracts
EXTENSION_BUILD_DIR=/absolute/path/to/extracted/chrome pnpm nx run extension:e2e-artifact
RAY_RELEASE_IMAGE_PREFIX=local/ray RAY_RELEASE_IMAGE_TAG=<40-character-commit> node scripts/testing/run-backend.mjs release artifact
SMOKE_BASE_URL=https://your-deployed-origin node scripts/release/framework-smoke.mjs
```

镜像验证入口只运行已存在的五个镜像，不重建、不发布。镜像 ID、日志、运行与
清理状态在 `dist/test-results/release/artifact/<run-id>/`。负向发布演练使用记录
命令替身，证明失败报告不会触发 push；它不等同于真实 registry 或生产部署验收。

Mobile 商店包、Desktop 签名/公证升级，以及真实厂商账户继续作为专项验收，
不能用无签名测试包通过代替。当前通过与限制见 [项目现状](status.md)。
