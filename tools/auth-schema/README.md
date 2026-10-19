# auth-schema · Better Auth CLI 隔离包

## 用途与分类

Nx 项目名 @ray/auth-schema-tool；type:platform、runtime:node、domain:auth。供认证维护者/CI 做逻辑 schema 对照，不供 Web/Native 或业务库 import。

此 package.json 隔离 CLI 的依赖解析；官方替代包 `auth` 与根 Better Auth runtime 都固定为 `1.7.11`。检查入口先验证两个 manifest 的版本相同，防止运行时升级后仍用旧生成器检查。旧 `@better-auth/cli` 已停止维护，其专用的 fetch/call 兼容依赖一并移除。

## 环境与运行

从根执行：

```sh
pnpm nx show project @ray/auth-schema-tool --json
pnpm nx run auth-server:schema-check
```

本工具包没有自己的 Nx build/test target，由 scripts/auth/check-auth-schema.mjs 调用本包安装的 auth executable。脚本在系统临时目录生成候选并清理，不修改受控 auth.prisma。注入 NODE_ENV=test、测试 auth/email/OAuth 值；POSTGRES_DATABASE_URL 固定为不连接真实数据库的占位 URL。不要把生产环境带入检查进程。

比较逻辑模型/字段/索引等，忽略物理 @map/@@map/@@schema，并排除窄白名单扩展；物理表映射必须另审 Prisma migration。

## 测试与维护

当前无本工具包单元测试；逻辑门禁执行上面的 schema-check。修改 comparer 时应补最小 Prisma fixture：缺字段、类型/默认值、索引变化、允许扩展以及物理映射的独立检查。不能扩大白名单吞掉真实漂移。

版本更新在独立评审中修改 manifest + lockfile 并验证输出，不使用 @latest 或临时 npx 下载。详细脚本边界见 [auth 脚本](../../scripts/auth/README.md)。

CLI 包名依据 [Better Auth 官方说明](https://better-auth.com/docs/concepts/cli)，仓库使用固定版本而不执行示例中的动态 latest 安装。
