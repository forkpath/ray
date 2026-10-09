# 持续集成检查

这些检查为框架持续维护服务，不要求使用框架的人手动逐项运行。

| 文件/命令                                                      | 用途                                                                                                        | 触发时机                   |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------- |
| `check-nx-cache-contracts.mjs` / `pnpm ci:nx-cache-contracts`  | 检查依赖边界、缓存输入、环境变量、禁止缓存的写入任务和 Action 固定版本                                      | CI；改项目配置后可本地运行 |
| `check-container-contracts.sh` / `pnpm ci:container-contracts` | Dockerfile Buildx 检查、Compose 渲染、入口语法检查；`--require-artifacts` 检查打包文件                      | CI；改 Docker/打包配置时   |
| `runtime-boundaries.test.mjs`                                  | 用实际 ESLint/浏览器打包验证 Web/Native 不引入 Node 专用依赖                                                | `pnpm ci:checks`           |
| `check-patches.mjs` / `pnpm ci:patches`                        | 报告本地补丁对应依赖的上游新正式版本和安全豁免剩余天数；registry 失败时返回失败                             | 每周安全扫描；改补丁前后   |
| `bootstrap-acceptance.sh`                                      | 在全新检出中执行 `bootstrap --seed --start`、`doctor --running`、重复运行与中断退出；已有 `.env` 时拒绝运行 | CI `bootstrap` 任务        |
| `clean.test.mjs`                                               | 临时仓库中验证清理器预览、防误删和符号链接处理                                                              | `pnpm ci:checks`           |

常规代码检查直接调用 `pnpm nx affected` / `pnpm nx run-many`。数据库 CI 在临时 PostgreSQL 上执行初始化迁移并再次执行，验证可重复部署。

检查围绕构建正确性、清理安全与运行时边界设置；简单命令包装不要求重复实现的测试。

容器检查需要 Docker Buildx 和镜像仓库访问；通过不等于已完成真实部署。运行时边界和清理测试均不连接生产数据库。
