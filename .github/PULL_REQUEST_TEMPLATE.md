## 目标分支与合并方式

- [ ] 目标分支是 `dev` 或 `arch`（`main` 不接受 PR，通过快进发布）。
- 合并方式：功能分支 → `dev` / `arch` 选 **Rebase and merge**；`arch` → `dev` 选 **Create a merge commit**。
  不使用 Squash。详见 [分支维护](../docs/development/branch-workflow.md)。
- 跳过的 CI 套件（标签）：无 / `ci:skip-mobile` / `ci:skip-desktop` / `ci:skip-extension`，原因：

## 变更原因与结果

说明触发场景、原来的问题及修改后的行为。涉及公开契约时给出调用示例。

## 验证

- 执行的 Nx 命令与结果：
- 集成／E2E 报告或 CI 链接：
- 未运行的检查、原因及剩余影响（没有则写“无”）：

## 兼容性与部署

说明数据库迁移、环境变量、公开 API 或原生依赖的变化；涉及部署时给出回退方式。
纯文档或无相关影响的变更可写“不适用”。

- [ ] 测试覆盖实际行为，并区分通过、失败和未验证的项目。
- [ ] 已同步受影响的命令示例和文档，未提交凭据或生成产物。
