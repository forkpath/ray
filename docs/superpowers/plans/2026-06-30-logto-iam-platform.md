# Logto IAM 平台（独立部署 + 配置即代码 + 自动开通）实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改动 ray 任何应用代码的前提下，交付一个独立可运行、可测试的 Logto IAM 平台：单实例共享身份层 + 配置即代码（Bootstrap）+ 按组织自动开通（Logto Organization + 专属业务库 + 路由）控制面核心。

**Architecture:** 单个共享 Logto OSS 实例承载唯一用户池（用户可跨组织），通过 Management API 以"配置即代码"方式声明应用/API 资源/组织模板（角色+scope）。一个独立的 Provisioner 控制面在组织创建时编排：① 调 Management API 建 Logto Organization 并按模板授角色；② 在 Postgres 集群上 `CREATE DATABASE` 出该组织专属业务库并登记到租户注册表；③ 产出该组织子系统的路由/域名配置。所有 IAM 资源对 ray 应用零侵入，独立 `iam/` 目录维护，可整体抽成独立仓库。

**Tech Stack:** Docker Compose（Logto OSS `ghcr.io/logto-io/logto`）、Postgres 17、TypeScript（ESM）、`@logto/api` Management SDK、Hono（Provisioner 轻量 HTTP 层）、`pg`（DB 编排）、Vitest（测试，与仓库一致）、Traefik（动态路由，Phase 3）。

---

## 关键架构决策（ADR-0001：身份层共享 vs 业务层隔离）

> **这是整份计划的地基，实现前必须理解，否则方向性错误。**

你的两个诉求存在天然张力：
- **「用户可跨组织」（Slack 式）** → 要求所有组织共享同一个用户池 / 同一登录入口。
- **「完整 per-org 隔离 + 自动开通」** → 要求每组织独立的数据/实例/域名。

**裁决：隔离边界划在「身份层 ↓ 业务层」之间，而不是划在组织之间。**

| 层 | 隔离策略 | 实例数 | 理由 |
|---|---------|-------|------|
| 身份/认证（Logto） | **共享** | 1 个 Logto OSS 实例（tenant=`default`） | 单一用户池才能让同一用户跨组织；OSS 单 tenant 限制对此无影响 |
| 组织/粗粒度角色 | 逻辑隔离 | Logto Organization（数量无限） | 一个用户属于多个 Organization，各自独立角色 |
| 业务数据 | **物理分库** | 每组织 1 个 Postgres database | 数据合规与隔离 |
| 子系统实例 | 可选物理隔离 | 每组织 1 套（大客户）/ 共享按 `org_id` 路由（小客户） | Provisioner 产出部署槽位 |
| 域名 | 独立 | `<org>.example.com` | 品牌与体验 |

**绝不能**给每个组织部署独立 Logto 实例——那样同一用户在不同组织会变成互不相通的多个账号，直接违背跨组织诉求。"per-org 隔离"由 **Provisioner** 在**业务层**实现，身份层始终单实例共享。

子系统侧的连接点：从 Logto 签发的 **organization token**（JWT）中取 `organization_id`、`aud=urn:logto:organization:<id>`、`scope` 决定"进哪个子系统、连哪个业务库、粗粒度能不能进"，细粒度权限由子系统自身数据库管理（见 ADR-0002）。

## 关键架构决策（ADR-0002：粗粒度 vs 细粒度权限归属）

- **Logto 管粗粒度**：组织级角色 → scope（如 `access:crm`、`access:billing`），本质是"子系统访问白名单"，进 token。
- **子系统管细粒度**：项目级/资源级/数据行级权限存在子系统自己的库（对应当前 ray `permissions.ts` 里的 product/order/customer 等业务资源）。
- 本计划**只交付 Logto 侧粗粒度模型**；细粒度权限属于后续「ray 子系统改造计划」，不在本计划范围。

---

## 范围检查与路线图（本文档 = Plan 1）

整体迁移跨多个独立子系统，按计划原则拆为 3 份可独立交付计划：

- **Plan 1（本文档）**：独立 Logto 平台 + 配置即代码 Bootstrap + 自动开通控制面核心。**零** ray 应用代码改动。可独立验证。
- **Plan 2（后续）**：路由与域名自动化（Traefik 动态路由 + 通配 DNS + 子系统部署模板）、Provisioner 端到端开通编排上线。
- **Plan 3（后续）**：ray 应用硬切换——移除 better-auth，`apps/web`+`services/engine` 接 Logto OIDC，再到 mobile/desktop/extension（greenfield，无数据迁移）。

> 本计划交付物全部位于新目录 `iam/`，与 ray 应用代码解耦，后续可 `git subtree split` 抽成独立仓库。

---

## 文件结构

```
iam/
├── package.json                         # 独立 workspace（不挂 ray 的 nx 图）
├── tsconfig.json
├── vitest.config.ts
├── .env.example                         # Logto/Provisioner/Postgres 配置样例
├── deploy/
│   ├── docker-compose.yml               # Logto core+admin + Postgres(iam) + (Phase3)Traefik
│   ├── logto.env.example
│   └── README.md                        # 部署与自定义域名说明
├── bootstrap/                           # 配置即代码（声明 Logto 资源）
│   ├── src/
│   │   ├── config.ts                    # 期望状态：applications / api-resources / org-template
│   │   ├── management-client.ts         # @logto/api 封装（client_credentials）
│   │   ├── reconcile.ts                 # 幂等 upsert：对比期望态与实际态
│   │   └── main.ts                      # CLI 入口：pnpm bootstrap
│   └── src/__tests__/
│       ├── reconcile.test.ts            # 纯逻辑：diff/幂等（mock client）
│       └── config.test.ts
├── provisioner/                         # 自动开通控制面核心
│   ├── src/
│   │   ├── tenant-registry.ts           # 租户注册表（org_id ↔ db/domain/状态）
│   │   ├── database-provisioner.ts      # CREATE DATABASE / DROP DATABASE 编排
│   │   ├── organization-provisioner.ts  # 调 Management API 建 org + 授角色
│   │   ├── provision-tenant.ts          # 编排：org → db → 注册（含补偿回滚）
│   │   ├── errors.ts
│   │   └── http.ts                      # Hono：POST /tenants, DELETE /tenants/:id
│   └── src/__tests__/
│       ├── database-provisioner.test.ts # 集成：真实 Postgres（testcontainer/本地）
│       ├── organization-provisioner.test.ts # 集成：真实 Logto
│       ├── provision-tenant.test.ts     # 编排 + 回滚（mock 子模块）
│       └── tenant-registry.test.ts
└── shared/
    └── src/jwt.ts                       # organization token 校验工具（供子系统复用）
```

设计原则：编排逻辑库优先（纯函数/类，可单测），HTTP 仅薄壳；副作用（Logto API、Postgres DDL）集中在各 provisioner 模块，便于在编排层 mock。

---

## 前置准备（Task 0）

### Task 0：独立 workspace 骨架

**Files:**
- Create: `iam/package.json`, `iam/tsconfig.json`, `iam/vitest.config.ts`, `iam/.env.example`

- [ ] **Step 1: 初始化目录与依赖**

```bash
mkdir -p iam/{deploy,bootstrap/src/__tests__,provisioner/src/__tests__,shared/src}
cd iam && pnpm init
pnpm add @logto/api pg hono @hono/node-server jose
pnpm add -D typescript vitest @types/node @types/pg tsx
```

- [ ] **Step 2: 写 `iam/tsconfig.json`（ESM, strict）**

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ES2022", "moduleResolution": "Bundler",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "types": ["node", "vitest/globals"], "outDir": "dist"
  },
  "include": ["bootstrap/src", "provisioner/src", "shared/src"]
}
```

- [ ] **Step 3: `iam/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { globals: true, environment: 'node' } })
```

- [ ] **Step 4: 在 `iam/package.json` 加 scripts**

```json
{
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "bootstrap": "tsx bootstrap/src/main.ts",
    "provisioner:dev": "tsx provisioner/src/http.ts"
  }
}
```

- [ ] **Step 5: 验证空测试可运行**

Run: `cd iam && pnpm vitest run --passWithNoTests`
Expected: PASS（0 个测试，退出码 0）

- [ ] **Step 6: Commit**

```bash
git add iam && git commit -m "chore(iam): scaffold standalone iam workspace"
```

---

## Phase 1：独立 Logto 部署

### Task 1：Logto OSS + Postgres 容器编排

**Files:**
- Create: `iam/deploy/docker-compose.yml`, `iam/deploy/logto.env.example`, `iam/deploy/README.md`

- [ ] **Step 1: 写 `docker-compose.yml`**

> Logto OSS 镜像会在 `DB_URL` 指向的空库上自动 seed 初始 schema 与默认 M2M（admin）应用。

```yaml
services:
  iam-postgres:
    image: postgres:17
    container_name: iam-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${IAM_PG_PASSWORD}
      POSTGRES_DB: logto
    ports: ['6432:5432']
    volumes: ['iam-pg:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 10

  logto:
    image: ghcr.io/logto-io/logto:latest
    container_name: iam-logto
    depends_on:
      iam-postgres: { condition: service_healthy }
    entrypoint: ['sh', '-c', 'npm run cli db seed -- --swe && npm start']
    environment:
      TRUST_PROXY_HEADER: '1'
      DB_URL: postgres://postgres:${IAM_PG_PASSWORD}@iam-postgres:5432/logto
      ENDPOINT: ${LOGTO_ENDPOINT}
      ADMIN_ENDPOINT: ${LOGTO_ADMIN_ENDPOINT}
    ports: ['3001:3001', '3002:3002']

volumes:
  iam-pg:
```

- [ ] **Step 2: 写 `logto.env.example`**

```
IAM_PG_PASSWORD=change-me
LOGTO_ENDPOINT=http://localhost:3001
LOGTO_ADMIN_ENDPOINT=http://localhost:3002
```

- [ ] **Step 3: 启动并验证 Logto 健康**

```bash
cd iam/deploy && cp logto.env.example .env
docker compose --env-file .env up -d
```

Run: `curl -sf http://localhost:3001/api/.well-known/openid-configuration | head -c 200`
Expected: 返回 OIDC discovery JSON（含 `authorization_endpoint`）

- [ ] **Step 4: 验证 Admin Console 可访问，手动完成首个管理员注册**

Run: 浏览器打开 `http://localhost:3002` → 完成初始管理员创建
Expected: 进入 Admin Console 首页

- [ ] **Step 5: 在 Admin Console 创建一个 M2M 应用授予 Management API 全部权限**（供 Bootstrap/Provisioner 使用），记录 `App ID`/`App Secret` 到 `iam/.env`（`LOGTO_M2M_APP_ID` / `LOGTO_M2M_APP_SECRET`）

- [ ] **Step 6: 验证可换取 Management API token**

Run:
```bash
curl -s "$LOGTO_ENDPOINT/oidc/token" -X POST \
  -u "$LOGTO_M2M_APP_ID:$LOGTO_M2M_APP_SECRET" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d grant_type=client_credentials \
  -d "resource=$LOGTO_ENDPOINT/api" -d scope=all | python3 -m json.tool
```
Expected: 返回含 `access_token` 的 JSON

- [ ] **Step 7: Commit**

```bash
git add iam/deploy && git commit -m "feat(iam): logto oss + postgres compose deployment"
```

---

## Phase 2：配置即代码（Bootstrap）

### Task 2：Management API 客户端封装

**Files:**
- Create: `iam/bootstrap/src/management-client.ts`
- Test: `iam/bootstrap/src/__tests__/management-client.test.ts`

- [ ] **Step 1: 写失败测试**（验证封装从 env 构造 client、暴露 `apiClient`）

```ts
import { describe, it, expect } from 'vitest'
import { createIamManagementClient } from '../management-client'

describe('createIamManagementClient', () => {
  it('throws when credentials missing', () => {
    expect(() => createIamManagementClient({ endpoint: '', m2mId: '', m2mSecret: '' }))
      .toThrow(/endpoint/i)
  })
})
```

- [ ] **Step 2: 运行确认失败** — `cd iam && pnpm vitest run management-client` → FAIL（模块不存在）

- [ ] **Step 3: 实现**

```ts
import { createManagementApi } from '@logto/api/management'

export interface IamMgmtConfig { endpoint: string; m2mId: string; m2mSecret: string }

export function createIamManagementClient(cfg: IamMgmtConfig) {
  if (!cfg.endpoint) throw new Error('Logto endpoint is required')
  if (!cfg.m2mId || !cfg.m2mSecret) throw new Error('M2M credentials are required')
  // OSS 固定 tenant 为 'default'
  return createManagementApi('default', {
    clientId: cfg.m2mId,
    clientSecret: cfg.m2mSecret,
    // 自托管需显式指定 endpoint
    apiIndicator: `${cfg.endpoint}/api`,
    tokenEndpoint: `${cfg.endpoint}/oidc/token`,
  })
}
```

- [ ] **Step 4: 运行确认通过** — `pnpm vitest run management-client` → PASS

- [ ] **Step 5: Commit** — `git commit -am "feat(iam): management api client wrapper"`

> 注：若 `@logto/api` 的自托管参数名与上不符，以 `node_modules/@logto/api` 的类型定义为准（NEVER guess——读类型签名）。

### Task 3：期望状态声明（应用 / API 资源 / 组织模板）

**Files:**
- Create: `iam/bootstrap/src/config.ts`
- Test: `iam/bootstrap/src/__tests__/config.test.ts`

- [ ] **Step 1: 写失败测试**（断言期望态包含 4 个平台应用 + 1 个 API 资源 + 组织角色→scope 映射）

```ts
import { describe, it, expect } from 'vitest'
import { desiredState } from '../config'

describe('desiredState', () => {
  it('declares one app per ray platform', () => {
    const names = desiredState.applications.map(a => a.name)
    expect(names).toEqual(expect.arrayContaining(['ray-web', 'ray-mobile', 'ray-desktop', 'ray-extension']))
  })
  it('maps org roles to subsystem access scopes', () => {
    const role = desiredState.organizationTemplate.roles.find(r => r.name === 'developer')
    expect(role?.scopes).toContain('access:crm')
  })
})
```

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `config.ts`**（声明式，无副作用）

```ts
export const desiredState = {
  apiResources: [
    { indicator: 'https://api.example.com', name: 'ray-api' },
  ],
  applications: [
    { name: 'ray-web', type: 'SPA', redirectUris: ['https://app.example.com/callback'] },
    { name: 'ray-mobile', type: 'Native', redirectUris: ['ray://callback'] },
    { name: 'ray-desktop', type: 'Native', redirectUris: ['ray-desktop://callback'] },
    { name: 'ray-extension', type: 'SPA', redirectUris: ['chrome-extension://*/callback'] },
  ],
  organizationTemplate: {
    // 粗粒度 scope = 子系统访问白名单（ADR-0002）
    scopes: ['access:crm', 'access:billing', 'access:dashboard', 'manage:members'],
    roles: [
      { name: 'org-admin', scopes: ['access:crm', 'access:billing', 'access:dashboard', 'manage:members'] },
      { name: 'developer', scopes: ['access:crm', 'access:dashboard'] },
      { name: 'analyst', scopes: ['access:dashboard'] },
      { name: 'billing-manager', scopes: ['access:billing'] },
    ],
  },
} as const
```

- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit** — `git commit -am "feat(iam): declarative desired state for logto resources"`

### Task 4：幂等 reconcile（diff + upsert）

**Files:**
- Create: `iam/bootstrap/src/reconcile.ts`
- Test: `iam/bootstrap/src/__tests__/reconcile.test.ts`

- [ ] **Step 1: 写失败测试**（用 fake client 验证：缺失则创建、已存在则跳过、二次运行无副作用）

```ts
import { describe, it, expect, vi } from 'vitest'
import { reconcileApplications } from '../reconcile'

describe('reconcileApplications', () => {
  it('creates only missing apps and is idempotent', async () => {
    const existing = [{ name: 'ray-web', id: '1' }]
    const create = vi.fn(async (a: { name: string }) => ({ id: 'new', ...a }))
    const desired = [{ name: 'ray-web' }, { name: 'ray-mobile' }]
    const r1 = await reconcileApplications({ list: async () => existing, create } as any, desired as any)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'ray-mobile' }))
    expect(r1.created).toEqual(['ray-mobile'])
  })
})
```

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `reconcile.ts`**（按 `name`/`indicator` 作幂等键，diff 后仅创建缺失项；返回 `{created, skipped}` 便于断言与日志）

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 加 `main.ts` CLI 串起 client+config+reconcile**，并写集成验证步骤

Run（对真实 Logto 跑两次，验证幂等）：
```bash
cd iam && pnpm bootstrap && pnpm bootstrap
```
Expected: 第一次输出创建若干资源；第二次输出全部 `skipped`，退出码 0

- [ ] **Step 6: 在 Admin Console 核对**应用/API 资源/组织角色已按 `config.ts` 出现

- [ ] **Step 7: Commit** — `git commit -am "feat(iam): idempotent reconcile bootstrap"`

---

## Phase 3：自动开通控制面核心（Provisioner）

### Task 5：租户注册表

**Files:**
- Create: `iam/provisioner/src/tenant-registry.ts`
- Test: `iam/provisioner/src/__tests__/tenant-registry.test.ts`

- [ ] **Step 1: 写失败测试** — 注册表对真实 Postgres 做 upsert/get/list/状态流转（`pending→active→deprovisioned`）。表 `iam_tenants(org_id PK, db_name, domain, status, created_at)`，建在 `iam-postgres` 的 `logto` 库或独立 `iam` 库。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**（`pg` 连接 + 建表迁移 + CRUD）
- [ ] **Step 4: 运行确认通过** — `pnpm vitest run tenant-registry`（需本地/容器 Postgres）
- [ ] **Step 5: Commit**

### Task 6：业务库编排（DDL）

**Files:**
- Create: `iam/provisioner/src/database-provisioner.ts`
- Test: `iam/provisioner/src/__tests__/database-provisioner.test.ts`

- [ ] **Step 1: 写失败测试** — `provisionDatabase('org_abc')` 在 Postgres 集群上创建 `tenant_org_abc` 库且可连接；重复调用幂等（已存在不报错）；`deprovisionDatabase` 能删除。库名需做标识符白名单校验（防注入：仅 `[a-z0-9_]`）。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现** — 用管理连接执行 `CREATE DATABASE`（注意 DDL 不能参数化，必须先正则校验库名再拼接）；`IF NOT EXISTS` 语义用 `pg_database` 预查实现。
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

> 安全要点：库名来源于 `org_id`，必须经 `assertSafeDbName()` 白名单校验后才能进入 SQL 字符串，单独写一条针对恶意 `org_id`（含 `;`/空格/引号）抛错的测试。

### Task 7：组织编排（Management API）

**Files:**
- Create: `iam/provisioner/src/organization-provisioner.ts`
- Test: `iam/provisioner/src/__tests__/organization-provisioner.test.ts`

- [ ] **Step 1: 写失败测试** — `createOrganization({ name })` 调真实 Logto 建 org 返回 `id`；`assignUserRole(orgId, userId, 'developer')` 成功；清理（删除 org）。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现** — 复用 Task 2 的 client：`POST /api/organizations`、`POST /api/organizations/{id}/users`、`POST /api/organizations/{id}/users/{userId}/roles`。
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

### Task 8：开通编排 + 补偿回滚

**Files:**
- Create: `iam/provisioner/src/provision-tenant.ts`, `iam/provisioner/src/errors.ts`
- Test: `iam/provisioner/src/__tests__/provision-tenant.test.ts`

- [ ] **Step 1: 写失败测试**（mock 三个子模块）：
  - happy path：依次 `createOrganization → provisionDatabase → registry.upsert(active)`，返回 `{ orgId, dbName }`。
  - 补偿：当 `provisionDatabase` 抛错时，必须回滚已创建的 organization（调用 `deleteOrganization`）并把注册表标记 `failed`，最终抛出 `ProvisionError`。

```ts
it('rolls back organization when database provisioning fails', async () => {
  const deps = makeDeps()
  deps.db.provisionDatabase.mockRejectedValueOnce(new Error('disk full'))
  await expect(provisionTenant({ name: 'acme', ownerUserId: 'u1' }, deps)).rejects.toThrow(/disk full/)
  expect(deps.org.deleteOrganization).toHaveBeenCalledWith('org-id')
  expect(deps.registry.markFailed).toHaveBeenCalled()
})
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现编排**（try/catch 分阶段补偿，每阶段记录已完成步骤用于逆序回滚）
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

### Task 9：HTTP 薄壳（Hono）

**Files:**
- Create: `iam/provisioner/src/http.ts`
- Test: `iam/provisioner/src/__tests__/http.test.ts`

- [ ] **Step 1: 写失败测试** — `POST /tenants {name, ownerUserId}` → 201 + `{orgId, dbName}`；入参缺失 → 400；`DELETE /tenants/:orgId` → 200 并触发 deprovision。用 `app.request()` 直接测，编排层注入 mock。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现** Hono 路由（仅校验 + 调编排，零业务逻辑）
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

### Task 10：organization token 校验工具（供子系统复用）

**Files:**
- Create: `iam/shared/src/jwt.ts`
- Test: `iam/shared/src/__tests__/jwt.test.ts`

- [ ] **Step 1: 写失败测试** — `verifyOrganizationToken(jwt, { orgId, requiredScopes })`：用 `jose` 远端 JWKS 验签；断言 `aud` 含 `urn:logto:organization:<orgId>`、`organization_id` 匹配、`scope` 覆盖所需；任一不满足抛错。用本地签发的测试 JWT + 本地 JWKS mock。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**（`createRemoteJWKSet(`${endpoint}/oidc/jwks`)` + `jwtVerify` + claim 校验）
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

> 此工具是 Plan 3 中 `services/engine` NestJS Guard 替换 better-auth `auth.api.getSession` 的核心；本计划先在 IAM 侧交付并测试，Plan 3 直接复用。

---

## 端到端验收（手动冒烟，全部通过即 Plan 1 完成）

- [ ] **A1**：`docker compose up` 后 Logto OIDC discovery 可访问，Admin Console 可登录
- [ ] **A2**：`pnpm bootstrap` 连跑两次幂等，Admin Console 中 4 个应用 + API 资源 + 4 个组织角色齐备
- [ ] **A3**：`pnpm provisioner:dev` 后 `curl -X POST .../tenants -d '{"name":"acme","ownerUserId":"<真实用户id>"}'` 返回 `orgId`+`dbName`
- [ ] **A4**：`psql` 确认 `tenant_acme` 库存在；`iam_tenants` 表中该 org 状态 `active`
- [ ] **A5**：Admin Console 中存在名为 `acme` 的 Organization，且指定用户已加入并具 `developer` 角色
- [ ] **A6**：故意用非法 `ownerUserId` 触发失败，确认 organization 被回滚、库未残留、注册表标记 `failed`
- [ ] **A7**：`cd iam && pnpm test` 全绿
- [ ] **A8**：全程未修改 `apps/`、`services/`、`libs/` 任一文件（`git status` 仅含 `iam/` 与本 plan 文档）

---

## 显式不在本计划范围（留给 Plan 2 / Plan 3）

- Traefik 动态路由、通配 DNS、子系统部署模板渲染与真实部署（Plan 2）
- 子系统业务库的 schema 迁移（子系统自身的 Prisma migrate，Plan 3）
- 移除 better-auth、`libs/auth` / `libs/srv-shared/auth` / `libs/studio` 改造、各 app 接入 Logto SDK（Plan 3）
- 细粒度业务权限（product/order/customer 等，子系统内部，Plan 3+）
- 用户数据迁移（greenfield，确认不需要）

---

## 给执行者的提醒

- 严格 TDD：先写失败测试、确认失败、再实现、确认通过、提交。
- 副作用集中、编排可 mock；真实 Logto / Postgres 的集成测试与纯逻辑单测分开跑。
- DDL 拼接前必过标识符白名单（Task 6 安全测试不可省）。
- `@logto/api` 自托管参数以本地类型定义为准，不臆测 API 形状。
- 每个 Task 独立提交，提交信息用仓库的 Conventional Commits（`feat(iam): ...`）。
