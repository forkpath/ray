# ray 硬切换：better-auth → Logto OIDC（Plan 3）实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **依赖：** Plan 1（Logto 平台 + Bootstrap，含 `iam/shared/src/jwt.ts` 组织 token 校验工具）与 Plan 2（路由/开通）已完成并验收。
>
> **前提（已确认）：** greenfield，无用户数据迁移；硬切换，不保留 better-auth 并行。

**Goal:** 移除 ray 全部 better-auth 实现，改为信任独立 Logto：`services/engine` 用 Logto 组织 token（JWT）做认证与粗粒度鉴权，`apps/web`/`mobile`/`desktop`/`extension` 改用对应 Logto SDK 完成 OIDC 登录与组织切换。细粒度业务权限留在子系统自身（ADR-0002），本计划不实现业务级权限模型。

**Architecture:** 删除 `libs/auth` 的 better-auth 服务端/客户端与 `libs/srv-shared/src/auth` 的 better-auth NestJS 集成。新建 `libs/iam`（共享）暴露：① 各平台 Logto SDK 配置工厂；② 复用 Plan 1 `verifyOrganizationToken` 的 NestJS `LogtoAuthGuard` + `@OrgRoles()`/`@Session()` 装饰器（保持与现有控制器装饰器同名同语义，最小化改动面）。引擎不再托管 `/api/auth`；用户/组织的"写"操作改走 Logto Management API（经 Plan 1 的 Provisioner 或引擎内 M2M 调用），"读"从 token claims 获取。Prisma 中 better-auth 模型删除，业务表保留并以 `userId`/`organizationId`（字符串，来自 Logto）为外部引用键。

**Tech Stack:** `@logto/react`(web) · `@logto/rn`(mobile) · `@logto/browser`(desktop/extension) · `jose`(引擎验签) · `@logto/api`(Management) · NestJS · Vitest。

---

## 关键架构决策

- **ADR-0004（保持装饰器契约不变）**：现有控制器大量使用 `@Session()`、`@Roles([...])`、`@AllowAnonymous()`、`@OptionalAuth()`（见 `services/engine/src/presentation/http/user/user.controller.ts`、`libs/srv-shared/src/auth/auth.decorator.ts`）。新 `LogtoAuthGuard` **复用同名装饰器与元数据键**（`PUBLIC`/`OPTIONAL`/`ROLES`），把 `request.session` 填充成与旧 `UserSession` 形状兼容的对象（`{ user: { id, roles }, organizationId }`）。如此控制器方法体几乎零改动，改动集中在 guard 与 session 来源。
- **ADR-0005（用户/组织写操作的归属）**：当前引擎 user/organization 控制器有 ban/delete/revoke-session/update 等"写"逻辑直接调 `auth.api.*`。Logto 下这些是 IAM 职责：保留 HTTP 形状，内部改调 Logto Management API（封装在 `libs/iam/server`）。无法或不应由业务侧承担的（如 session 撤销）直接走 Management API。
- **ADR-0006（hosted 登录取代自建 UI）**：`libs/studio/src/modules/auth/*`、`apps/mobile/src/modules/auth/*` 的自建登录/注册/2FA/passkey UI 删除，改为重定向到 Logto 托管登录页（可定制品牌）。组织管理 UI（成员/邀请/角色）改调 Management API 包装的 api-client 域。

---

## 文件结构（变更总览）

```
新增 libs/iam/
├── src/index.ts
├── src/client/web.ts          # createLogtoWebConfig + 重导出 @logto/react
├── src/client/mobile.ts       # createLogtoRnConfig + 重导出 @logto/rn
├── src/client/browser.ts      # desktop/extension 用 @logto/browser
├── src/server/management.ts   # Management API 封装（用户/组织写操作）
├── src/server/scopes.ts       # 粗粒度 scope 常量（与 iam bootstrap config 对齐）
└── src/nest/                  # 复制/迁移自 srv-shared，但基于 Logto
    ├── logto-auth.guard.ts    # 复用 iam/shared verifyOrganizationToken
    ├── logto-auth.module.ts   # forRoot：注册全局 guard（不再 mount /api/auth）
    ├── auth.decorator.ts      # @Session/@OrgRoles/@AllowAnonymous/@OptionalAuth（同名）
    └── __tests__/*

删除：
├── libs/auth/**（整个 better-auth 实现）
├── libs/srv-shared/src/auth/**（better-auth NestJS 集成）
├── libs/studio/src/modules/auth/**（自建登录 UI）
├── apps/mobile/src/modules/auth/**、apps/web/src/routes/auth/**（自建登录路由/UI）
└── libs/pg-dao/src/models/auth.prisma 中 better-auth 模型

修改：
├── services/engine/src/app.module.ts（AuthModule→LogtoAuthModule）
├── services/engine/.../user.repository.ts、user/organization 控制器（auth.api→Management）
├── apps/web/src/routes/_app.tsx、auth.tsx、main 入口（LogtoProvider + callback）
├── apps/{mobile,desktop,extension} 的 auth 入口
└── libs/api-client/src/domains/{auth,users,organizations,admin}.ts（对齐新后端）
```

> 硬切换策略：**自底向上、按可独立验证的垂直切片推进**，每个 Phase 结束都能 `nx run <project>:test` + 手动冒烟。引擎先行（它是所有客户端的信任锚）。

---

## Phase 0：共享 IAM 库骨架

### Task 0：新建 `libs/iam`

**Files:**
- Create: `libs/iam/project.json`, `libs/iam/package.json`, `libs/iam/tsconfig*.json`, `libs/iam/src/index.ts`
- Reference: 仿照 `libs/auth/project.json` 的 nx 配置与 tags（`scope:shared`/`type:lib`）

- [ ] **Step 1:** 用 nx 生成库（先调 `nx-generate` skill 确认生成器语法）

Run: `pnpm nx g @nx/js:lib iam --directory=libs/iam --tags=scope:shared,type:lib --unitTestRunner=vitest`
Expected: 生成库骨架，`nx run iam:test` 可跑空测试

- [ ] **Step 2:** 加依赖

Run: `pnpm add @logto/react @logto/rn @logto/browser @logto/api jose jose`
（按平台实际需要分别加入；server 侧 `jose`/`@logto/api`，client 侧各 SDK）

- [ ] **Step 3:** `libs/iam/src/server/scopes.ts` 声明粗粒度 scope 常量，**与 `iam/bootstrap/src/config.ts` 的 `organizationTemplate.scopes` 严格一致**（建议从单一来源同步；先手抄 + 加一条一致性断言测试）。

- [ ] **Step 4: Commit** — `git commit -m "feat(iam-lib): scaffold shared logto integration library"`

---

## Phase 1：引擎认证内核（NestJS Logto Guard）

### Task 1：Logto 装饰器（同名契约）

**Files:**
- Create: `libs/iam/src/nest/auth.decorator.ts`
- Test: `libs/iam/src/nest/__tests__/auth.decorator.test.ts`

- [ ] **Step 1: 写失败测试** — `@AllowAnonymous()` 设置 `PUBLIC=true` 元数据、`@OrgRoles(['developer'])` 设置 `ROLES`、`@OptionalAuth()` 设置 `OPTIONAL`；`@Session()` 参数装饰器从 `request.session` 取值。语义与 `libs/srv-shared/src/auth/auth.decorator.ts` 等价。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**（直接迁移旧装饰器，重命名 `Roles`→`OrgRoles` 并保留 `Roles` 别名导出以减小改动面）
- [ ] **Step 4: 运行确认通过** — `nx run iam:test`
- [ ] **Step 5: Commit**

### Task 2：LogtoAuthGuard（复用 verifyOrganizationToken）

**Files:**
- Create: `libs/iam/src/nest/logto-auth.guard.ts`
- Test: `libs/iam/src/nest/__tests__/logto-auth.guard.test.ts`

- [ ] **Step 1: 写失败测试**（mock 一个 `verify` 函数，覆盖 http/ws context）：
  - 无 Bearer → `UnauthorizedException`（`@AllowAnonymous` 时放行）。
  - 校验通过 → `request.session = { user:{ id, roles }, organizationId }`，且 `request.user` 同步。
  - `@OrgRoles(['analyst'])` 但 token roles 不含 → `ForbiddenException`；含则放行。
  - `@OptionalAuth` 且无 token → 放行且 `session=null`。

```ts
it('rejects when required org role missing', async () => {
  const guard = makeGuard({ verify: async () => ({ sub: 'u1', organization_id: 'org1', roles: ['analyst'], scope: 'access:dashboard' }) })
  const ctx = httpCtx({ headers: { authorization: 'Bearer x' } }, { ROLES: ['developer'] })
  await expect(guard.canActivate(ctx)).rejects.toThrow('Forbidden')
})
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现** — 结构对照旧 `auth.guard.ts`（保留 `AuthContextErrorMap` 的 http/ws/rpc 分支），但 session 来源换成：从 `Authorization: Bearer` 取 token → 调 `iam/shared` 的 `verifyOrganizationToken`（经 DI 注入，便于测试）→ 映射 claims 到兼容 session。角色取 token `roles`（Logto 组织角色），不再读 `user.role` 字符串。
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

### Task 3：LogtoAuthModule（全局 guard，移除 /api/auth 托管）

**Files:**
- Create: `libs/iam/src/nest/logto-auth.module.ts`
- Test: `libs/iam/src/nest/__tests__/logto-auth.module.test.ts`

- [ ] **Step 1: 写失败测试** — `LogtoAuthModule.forRoot({ endpoint, audience })` 提供 `APP_GUARD=LogtoAuthGuard`；**不**注册任何 better-auth 中间件/handler（断言不存在 `/api/auth` mount 行为）；`disableGlobalAuthGuard` 选项保留。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**（精简版 `ConfigurableModuleClass`，去掉 hooks/toNodeHandler/SkipBodyParsing 全部 better-auth 逻辑）
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

---

## Phase 2：引擎切换

### Task 4：替换 app.module 认证装配

**Files:**
- Modify: `services/engine/src/app.module.ts:12,17,50`（`@libs/auth/server`→`@libs/iam`，`AuthModule.forRoot({auth})`→`LogtoAuthModule.forRoot({endpoint, audience})`）
- Modify: 引擎入口 `main.ts`（如有针对 `/api/auth` 的 body-parser 跳过，移除）
- **Modify（Kong 衔接，源自 Plan 2 ADR）：`iam/deploy/kong/base.yml`** —— 删除 `engine-auth` Service/Route（`/api/auth` → engine），删后 `deck gateway sync --select-tag base` 下发。引擎不再托管 `/api/auth`，该网关路由必须同步移除，否则会指向已不存在的端点。
- Test: `services/engine/src/__tests__/auth-wiring.spec.ts`（新增）

> **跨计划依赖提示：** `/api/auth` 这条 Kong 路由是 Plan 2 `base.yml` 从现有 `docker/kong/kong.yml` 原样保留下来的（Plan 2 显式声明"由 Plan 3 调整"）。本 Task 是它的唯一收口点——改完用 `deck gateway diff --select-tag base` 确认仅此一条被删、租户动态路由（`org:*` tag）不受影响。

- [ ] **Step 1: 写失败测试** — 启动 Nest 测试模块，断言：受保护路由无 token 返回 401；带 mock 校验通过的 token 返回 200；`/api/auth/*` 已不存在（404）。用 `overrideProvider` 注入 fake 校验。
- [ ] **Step 2: 运行确认失败** — `nx run engine:test`
- [ ] **Step 3: 实现** 装配替换
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 移除 Kong `/api/auth` 路由（Plan 2 衔接收口）** — 编辑 `iam/deploy/kong/base.yml` 删除 `engine-auth` Service/Route，执行 `deck gateway sync --select-tag base iam/deploy/kong/base.yml`；再 `deck gateway diff --select-tag base` 确认仅此一条变更、`org:*` 租户动态路由不受影响。
  - 验证：`curl -i -H 'Host: ${DOMAIN}' http://localhost/api/auth/ok-any-path` → 404（Kong 已无该路由）
- [ ] **Step 6: Commit**

### Task 5：user 仓储/控制器去 better-auth（auth.api → Management API）

**Files:**
- Modify: `services/engine/src/infrastructure/repositories/user.repository.ts`（删 `import { auth } from '@libs/auth/server'`；`getSessions`/ban/delete/set-password/revoke 等改调 `libs/iam/src/server/management.ts`）
- Modify: `services/engine/src/presentation/http/user/user.controller.ts`、`organization/user-organization.controller.ts`（`AuthSession` 类型来源换成 `@libs/iam`；方法体保持，因 session 形状兼容）
- Modify: 受影响的 use-case/mapper（`application/mappers/user.mapper.ts` 等如读 better-auth 字段则改 token/Management 字段）
- Test: 既有 `delete-account.usecase.spec.ts` 等更新 + 新增 management 适配测试

- [ ] **Step 1: 写失败测试** — `libs/iam/src/server/management.ts` 的 `revokeUserSessions(userId)`/`deleteUser(userId)`/`listUserSessions(userId)` 调 Management API（mock fetch/SDK，断言正确 endpoint 与鉴权头）。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现** management 封装 + 替换仓储调用
- [ ] **Step 4: 运行确认通过** — `nx run engine:test`
- [ ] **Step 5: Commit**

### Task 6：api-client 鉴权域对齐

**Files:**
- Modify: `libs/api-client/src/domains/auth.ts`（移除 `/auth/login`、`/auth/register`、`/auth/logout` —— 登录改由前端 Logto SDK 直连，不经引擎；或保留 `logout` 走 Management 撤销）
- Modify: `libs/api-client/src/domains/{users,organizations,admin}.ts`（凡依赖 better-auth 响应形状的，改对齐新引擎 DTO）
- Modify: `libs/payload`（`loginReqSchema`/`registerReqSchema` 等若不再使用则删除，连带 zod 类型）
- Test: 受影响域的工厂测试更新

- [ ] **Step 1–5:** 按域逐个 TDD（先改测试断言新行为→失败→改实现→通过→提交）。每删一个 mutation，全局 grep 其引用并清理（`authMutations.login` 等）。

---

## Phase 3：web 切换（apps/web + libs/studio）

### Task 7：LogtoProvider + callback + 守卫

**Files:**
- Create: `libs/iam/src/client/web.ts`（`createLogtoWebConfig({ endpoint, appId, resources, scopes })`）
- Modify: `apps/web` 根入口包 `<LogtoProvider config>`；新增 `apps/web/src/routes/callback.tsx`（处理 OIDC 回调）
- Modify: `apps/web/src/routes/_app.tsx`（`beforeLoad` 用 `@logto/react` 的 `isAuthenticated`/`getOrganizationToken` 取代 `authClient.getSession()`；组织列表/活跃成员从 token claims 或 Management 读）
- Modify: `apps/web/src/routes/auth.tsx`（登录入口改 `signIn(redirectUri)` 跳 Logto 托管页）
- Modify: `libs/studio/src/lib/auth/{client,server}.ts`（重写为 Logto 版本：client 导出 `useLogto` 封装；server 端 `getSession` 用 `iam/shared` 校验 cookie/token）
- Test: web 关键守卫的单测（mock logto hooks）；`apps/web-e2e` Playwright 冒烟更新

- [ ] **Step 1: 写失败测试** — `_app` 守卫：未认证 → 重定向到登录；已认证无活跃组织 → 重定向到组织选择；已认证有组织 → 放行并暴露 `organizationId`。用 mock 的 logto client。
- [ ] **Step 2: 运行确认失败** — `nx run web:test`
- [ ] **Step 3: 实现** Provider + callback + 守卫重写
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5:** 手动冒烟：`pnpm dev:web` → 点击登录跳 Logto → 登录回调 → 选组织 → 进入应用；切换组织走 `getOrganizationToken(orgId)`
- [ ] **Step 6: Commit**

### Task 8：删除 web/studio 自建登录 UI

**Files:**
- Delete: `libs/studio/src/modules/auth/**`、`apps/web/src/routes/auth/{login,register,join,error,password}*`
- Modify: 清理所有对已删组件的 import（`nx run web:typecheck` 驱动）

- [ ] **Step 1:** 删除目录后 `nx run web:typecheck` → 收集所有断裂引用
- [ ] **Step 2:** 逐个修复/删除引用直至 typecheck 通过
- [ ] **Step 3:** `nx run web:build` 通过
- [ ] **Step 4: Commit**

---

## Phase 4：mobile / desktop / extension 切换

### Task 9：mobile（@logto/rn）

**Files:**
- Create: `libs/iam/src/client/mobile.ts`（`createLogtoRnConfig`，scheme `ray://callback`，SecureStore）
- Modify: `apps/mobile/src/lib/auth/index.ts`（替换 `@libs/auth/client/mobile`）、`apps/mobile/src/config/auth.ts`
- Delete: `apps/mobile/src/modules/auth/**`（自建登录/2FA/OTP UI）
- Modify: `apps/mobile/src/modules/organization/**`（成员/邀请/角色改调 Management 包装的 api-client）
- Test: `nx run mobile:typecheck` + `nx run mobile:export`（仓库既有 verify:mobile 口径）

- [ ] **Step 1:** 替换 client 入口 → `nx run mobile:typecheck` 收集断裂
- [ ] **Step 2:** 删自建 UI、改组织管理调用直至 typecheck 通过
- [ ] **Step 3:** 冒烟：Expo 启动，触发 `signIn` 走系统浏览器 OIDC，回调入会话，组织切换正常
- [ ] **Step 4: Commit**

### Task 10：desktop（Electron）与 extension（WXT）

**Files:**
- Create: `libs/iam/src/client/browser.ts`（`@logto/browser`，desktop scheme `ray-desktop://callback`，extension `chrome-extension://<id>/callback`）
- Modify: `apps/extension/src/lib/auth/index.ts`、`apps/extension/src/lib/auth-cookie.ts`、`apps/extension/src/lib/api/index.tsx`（token 注入）
- Modify: desktop 对应 auth 入口（BrowserWindow 内完成 OIDC）
- Delete: 两端自建登录 UI（如有）
- Test: `nx run extension:build-chrome`、desktop build 通过 + 手动冒烟

- [ ] **Step 1–4:** 同 Task 9 的 typecheck 驱动法逐端推进，每端独立提交。

---

## Phase 5：清库与依赖收尾

### Task 11：删除 Prisma better-auth 模型

**Files:**
- Delete/Modify: `libs/pg-dao/src/models/auth.prisma`（删除 User/Session/Account/Verification/Passkey/TwoFactor/Organization/Member/Invitation/OrganizationRole）
- Modify: 业务模型中对上述模型的外键关系，改为存储 Logto 的 `userId`/`organizationId` 字符串（无 FK 约束，应用层校验）
- Modify: `libs/auth/project.json` 的 `generate-auth-schema` target 删除

- [ ] **Step 1:** 改 schema → `pnpm db:validate`
- [ ] **Step 2:** `pnpm db:generate`，修复 `@prisma/client` 类型断裂（业务仓储里引用已删模型处）
- [ ] **Step 3:** greenfield 下重置开发库：`pnpm db:migrate cutover-remove-better-auth` 生成迁移并 `pnpm db:reset`
- [ ] **Step 4:** `nx run-many -t typecheck` 全绿
- [ ] **Step 5: Commit**

### Task 12：移除 better-auth 依赖与死目录

**Files:**
- Delete: `libs/auth/**`、`libs/srv-shared/src/auth/**`（确认 `libs/srv-shared/src/index.ts` 不再导出）
- Modify: 根 `package.json` 移除 `better-auth`、`@better-auth/expo`、`@better-auth/passkey`
- Modify: 全局 grep 残留 `@libs/auth`、`better-auth`、`authClient`（来自旧 client）确保 0 引用

- [ ] **Step 1:** `grep -rl "better-auth\|@libs/auth" apps libs services --include="*.ts" --include="*.tsx" | grep -v node_modules` → 必须为空
- [ ] **Step 2:** `pnpm install`（锁文件更新）
- [ ] **Step 3:** `nx run-many -t lint,typecheck,test` 全绿
- [ ] **Step 4: Commit** — `git commit -m "chore: remove better-auth after logto cutover"`

---

## 端到端验收（全平台冒烟，全过即 Plan 3 完成）

- [ ] **A1（引擎）**：受保护接口无 token→401；持 Logto 组织 token→200；`/api/auth/*` 返回 404
- [ ] **A2（引擎鉴权）**：token 角色不含所需 `@OrgRoles` → 403；含 → 200
- [ ] **A3（web）**：登录跳 Logto 托管页→回调→选组织→进入应用；切换组织后请求带新 `organizationId` 的 token，命中不同组织数据
- [ ] **A4（跨组织用户）**：同一用户加入 org-A 与 org-B，登录后可切换，两侧角色/数据不同（验证 ADR-0001 落地）
- [ ] **A5（mobile）**：Expo OIDC 登录 + 组织切换正常
- [ ] **A6（desktop/extension）**：各自 OIDC 流程登录成功、API 带 token 调通
- [ ] **A7（清理）**：`grep -r better-auth`（排除 node_modules）为空；`nx run-many -t lint,typecheck,test` 全绿；`pnpm build:web && pnpm build:engine` 通过
- [ ] **A8（DB）**：Prisma 不含 better-auth 模型；业务表以字符串 `userId`/`organizationId` 引用 Logto 身份

---

## 风险与回退

- **硬切换无并行**：在功能分支完成全部 Phase 并通过 A1–A8 后再合并；合并前打 tag `pre-logto-cutover` 便于整体回退。
- **api-client 双轨**：当前存在 better-auth client 与 `api-client` 自建 `/auth/*` 双轨（见 `domains/auth.ts`）。Plan 3 统一为「登录走 Logto SDK，业务走 api-client」，Task 6 必须把两轨的残留全部收敛，避免半切换状态。
- **scope/角色漂移**：`libs/iam/src/server/scopes.ts` 与 `iam/bootstrap/src/config.ts` 必须一致（Task 0 Step 3 的一致性测试是护栏）。

---

## 显式不在本计划范围

- 细粒度业务权限模型（product/order/customer 等资源级/数据行级，子系统内部）——后续「子系统业务权限计划」
- 子系统真实 schema 与 Plan 2 迁移执行器的对接细节
- Logto 托管登录页的品牌深度定制（基础定制在 Bootstrap 即可）
