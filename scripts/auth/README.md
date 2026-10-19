# Better Auth 模型检查

`check-auth-schema.mjs` 是认证维护工具：根据 `libs/auth-server/src/lib/auth-server.ts` 的 Better Auth 配置，在系统临时目录生成候选 Prisma 模型，再与 `libs/pg-dao/src/models/auth.prisma` 对比，最后删除临时目录。

## 什么时候使用

- 升级 Better Auth 或其 CLI 后。
- 增删 organization、two-factor、passkey 等影响数据库结构的认证插件后。
- 修改认证字段、认证配置或 `auth.prisma` 后。

```sh
pnpm nx run auth-server:schema-check
```

普通页面/业务开发、每次启动和 `pg-dao:generate` 都不需要执行。CI 保留显式调用，帮助框架维护者发现依赖和认证模型不一致。

它不执行数据库迁移、不覆盖受控模型，也不连接数据库检查实际表结构。发现差异时应审核差异，修改模型，再通过标准 Prisma 迁移处理；不要直接覆盖自定义关系。

比较器检查逻辑字段、类型、默认值、关系和索引，忽略物理映射及本项目明确列出的计费关系/索引扩展。因此它是辅助检查，不能替代数据库约束验证或真实登录测试。

CLI 通过 `tools/auth-schema` 隔离固定版本（`auth@1.7.11` 与运行时 `better-auth@1.7.11`），不会动态下载 latest。入口拒绝两个 manifest 的版本不一致，也拒绝根 manifest 中与 `better-auth` 版本不同的 `@better-auth/*` 包；升级时仍需审核候选 schema 差异。运行注入测试认证/邮件/OAuth 值；数据库地址使用占位值，不继承真实数据库配置。
