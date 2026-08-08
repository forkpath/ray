# 路由与域名自动化 + 子系统部署模板（Plan 2 · Kong Admin API 版）实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **依赖：** 本计划依赖 Plan 1（`docs/superpowers/plans/2026-06-30-logto-iam-platform.md`）已完成——`iam/provisioner` 控制面核心、租户注册表、Logto Bootstrap 均已就绪。

**Goal:** 把 Plan 1 的「逻辑开通」升级为「物理可访问」：每个组织获得独立域名 `<org>.example.com`，请求经**现有 Kong 网关**按 Host 路由到该组织的子系统实例，并由 Provisioner 在开通时通过 **Kong Admin API 实时创建 Service/Route/插件**、产出子系统部署清单、对该组织专属业务库执行子系统 Prisma 迁移。

**Architecture:** 复用 ray 既有 Kong，但从 DB-less 切换到 **Postgres-backed 模式**，使 Admin API 的变更可持久化、即时生效、跨实例共享。**静态基础设施配置**（engine-api、web、acme、rate-limiting、cors、pre-function，源自现有 `docker/kong/kong.yml`）通过 `deck gateway sync` 一次性、幂等地灌入 Kong DB。**每组织的动态路由**由 Provisioner 在开通时经 Admin API `POST /services`（指向该组织子系统 upstream）+ `POST /routes`（`hosts=[<org>.example.com]`）+ 挂载限流/CORS 插件创建；解除开通时逆向 `DELETE`。Provisioner 同时渲染子系统部署清单并对业务库执行迁移。通配 DNS `*.example.com` 指向 Kong 入口。

**Tech Stack:** Kong Gateway（DB 模式，Postgres）、`deck`（静态声明式同步）、Kong Admin API、TypeScript（沿用 `iam/`）、`prisma migrate deploy`、Vitest。

---

## 关键架构决策

### ADR-0003（修订）：复用 Kong + 切 DB 模式 + Admin API 动态路由

- ray 已用 Kong（DB-less 声明式 `docker/kong/kong.yml`：`/api`→engine、`/api/auth`→engine、`/`→web，含 acme/rate-limiting/cors/pre-function）。**不引入 Traefik**，避免双网关。
- 方案 B（生产级）：Kong 切 **Postgres-backed 模式**。Admin API 写入即持久化、即时生效（无需 reload），且多 Kong 实例共享同一 DB——符合生产部署。
- **职责分层**：
  - **静态基础设施配置**（与组织无关：engine/web/全局插件）→ 由 `deck gateway sync` 从 `iam/deploy/kong/base.yml`（从现有 kong.yml 转换而来）幂等下发，纳入版本控制。
  - **动态租户路由**（每组织一条）→ Provisioner 经 Admin API 实时增删，不写进 deck base，避免 `deck sync` 误删（用 `--select-tag` 隔离，见 Task 1）。

### ADR-0007：Admin API 必须内网隔离

- Kong Admin API（默认 `:8001`）**绝不可暴露公网**。仅绑定容器内网，Provisioner 与 Kong 同网络访问；对外只暴露 proxy（`:80/:443`）。验收含一条"公网访问 Admin API 失败"的检查。

### ADR-0008：通配证书策略

- 每组织子域 `<org>.example.com` 的证书：复用 Kong **acme 插件的按需签发（http-01，per-SNI）**——动态创建的 Route 命中后 Kong 自动为该 host 申请证书，无需 DNS-01 plumbing。
- 备选（需通配证书时）：acme 插件 + DNS-01 申请 `*.example.com`。本计划默认按需 http-01；DNS-01 留作增量 Plan 2.1。

### ADR-0009：tier 决定实例形态（不变）

- `dedicated`（大客户）：独立子系统容器 + 独立库；Kong Service 指向该组织专属 upstream。
- `shared`（小客户）：共享子系统容器；Kong Route 仍按域名转发到共享 Service，子系统从 token 的 `organization_id` 选库。

---

## 文件结构

```
iam/
├── deploy/
│   ├── docker-compose.yml            # 扩展：kong-database(pg) + kong-migrations + kong(DB模式)
│   ├── kong/
│   │   ├── base.yml                  # 静态配置（从 docker/kong/kong.yml 转换，打 tag: base）
│   │   └── README.md                 # deck sync 与 Admin API 隔离说明
├── provisioner/src/
│   ├── tenant-registry.ts            # 扩展：domain / tier / kong_service_id / kong_route_id（迁移）
│   ├── routing/
│   │   ├── kong-admin.ts             # Admin API 客户端：create/delete service+route+plugin
│   │   └── __tests__/kong-admin.test.ts
│   ├── deploy/
│   │   ├── manifest-renderer.ts       # 渲染子系统部署清单（dedicated/shared）
│   │   ├── deployer.ts                # Deployer 接口 + ComposeDeployer/NoopDeployer
│   │   ├── subsystem-migrator.ts      # 对组织业务库执行 prisma migrate deploy
│   │   └── __tests__/*.test.ts
│   ├── provision-tenant.ts            # 扩展编排：org→db→migrate→kong-route→deploy→registry
│   └── __tests__/provision-tenant.test.ts
├── runtime/tenants/<org>/             # 渲染出的部署清单（gitignore）
└── templates/
    └── subsystem.compose.eta
```

---

## Phase 1：Kong 切 DB 模式 + 静态配置迁移

### Task 1：Kong DB-mode 部署 + base 配置 deck 同步

**Files:**
- Modify: `iam/deploy/docker-compose.yml`
- Create: `iam/deploy/kong/base.yml`, `iam/deploy/kong/README.md`

- [ ] **Step 1: 在 compose 加 `kong-database`（postgres:17，独立卷）+ `kong-migrations`（一次性 `kong migrations bootstrap`）+ `kong`（DB 模式）**

```yaml
  kong-database:
    image: postgres:17
    environment:
      POSTGRES_USER: kong
      POSTGRES_PASSWORD: ${KONG_PG_PASSWORD}
      POSTGRES_DB: kong
    volumes: ['kong-pg:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U kong']
      interval: 5s
      timeout: 5s
      retries: 10

  kong-migrations:
    image: kong:3.7
    command: kong migrations bootstrap
    depends_on:
      kong-database: { condition: service_healthy }
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_PASSWORD: ${KONG_PG_PASSWORD}
    restart: on-failure

  kong:
    image: kong:3.7
    depends_on:
      kong-database: { condition: service_healthy }
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_PASSWORD: ${KONG_PG_PASSWORD}
      # Admin API 只绑内网 8001；proxy 暴露 80/443
      KONG_ADMIN_LISTEN: '0.0.0.0:8001'
      KONG_PROXY_LISTEN: '0.0.0.0:80, 0.0.0.0:443 ssl'
    ports:
      - '80:80'
      - '443:443'
      # 注意：不要映射 8001 到宿主公网；如需本机调试用 127.0.0.1:8001:8001
      - '127.0.0.1:8001:8001'
    volumes: ['kong-prefix:/usr/local/kong']

volumes:
  kong-pg:
  kong-prefix:
```

- [ ] **Step 2: 把现有 `docker/kong/kong.yml` 转换为 `iam/deploy/kong/base.yml`**，给所有静态实体打 `tags: [base]`（用于 deck `--select-tag base` 隔离，避免误删 Provisioner 动态创建的资源）。保留 engine-api / engine-auth / web / acme / rate-limiting / cors / pre-function。

> 注：Plan 3 切 Logto 后 `/api/auth` 路由会移除；本计划保持现状，由 Plan 3 调整 base.yml。

- [ ] **Step 3: 启动并跑迁移**

Run: `cd iam/deploy && docker compose up -d kong-database kong-migrations kong`
Expected: `kong-migrations` 退出码 0；`curl -sf http://127.0.0.1:8001/status` 返回 Kong 状态 JSON

- [ ] **Step 4: 用 deck 幂等同步 base 配置**

Run:
```bash
deck gateway sync --kong-addr http://127.0.0.1:8001 --select-tag base iam/deploy/kong/base.yml
deck gateway diff --kong-addr http://127.0.0.1:8001 --select-tag base iam/deploy/kong/base.yml
```
Expected: 首次 sync 创建静态实体；diff 显示 `0 creates, 0 updates, 0 deletes`（幂等）

- [ ] **Step 5: 验证静态路由可用**

Run: `curl -sf -H 'Host: ${DOMAIN}' http://localhost/api/health`（或既有健康端点）
Expected: 命中 engine（证明 DB 模式下静态路由生效）

- [ ] **Step 6: Commit** — `git commit -am "feat(iam): switch kong to db-mode, seed static config via deck"`

---

## Phase 2：租户注册表 + Kong Admin 客户端

### Task 2：扩展租户注册表（domain / tier / kong ids）

**Files:**
- Modify: `iam/provisioner/src/tenant-registry.ts`
- Test: `iam/provisioner/src/__tests__/tenant-registry.test.ts`（追加）

- [ ] **Step 1: 写失败测试** — `upsert` 持久化 `domain`、`tier('dedicated'|'shared')`、`kongServiceId`、`kongRouteId`；旧记录兼容读取。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现** — 幂等迁移 `ALTER TABLE iam_tenants ADD COLUMN IF NOT EXISTS ...`，更新类型与读写。
- [ ] **Step 4: 运行确认通过** — `cd iam && pnpm vitest run tenant-registry`
- [ ] **Step 5: Commit**

### Task 3：Kong Admin API 客户端

**Files:**
- Create: `iam/provisioner/src/routing/kong-admin.ts`
- Test: `iam/provisioner/src/routing/__tests__/kong-admin.test.ts`

- [ ] **Step 1: 写失败测试**（mock `fetch`，断言 Admin API 调用形状）

```ts
import { describe, it, expect, vi } from 'vitest'
import { KongAdminClient } from '../kong-admin'

describe('KongAdminClient', () => {
  it('creates a tenant service+route tagged by org', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'svc-1' }) }) // POST /services
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'rt-1' }) })  // POST /routes
    const kong = new KongAdminClient('http://kong:8001', fetchMock as any)
    const res = await kong.createTenantRoute({ orgId: 'acme', domain: 'acme.example.com', upstreamUrl: 'http://sub-acme:3000' })
    expect(res).toEqual({ serviceId: 'svc-1', routeId: 'rt-1' })
    // service 指向 upstream，打 org tag
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://kong:8001/services',
      expect.objectContaining({ method: 'POST' }))
    const svcBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body)
    expect(svcBody).toMatchObject({ url: 'http://sub-acme:3000', tags: ['tenant', 'org:acme'] })
    // route 绑定 host
    const rtBody = JSON.parse((fetchMock.mock.calls[1][1] as any).body)
    expect(rtBody).toMatchObject({ hosts: ['acme.example.com'], tags: ['tenant', 'org:acme'] })
  })

  it('deletes route then service on teardown (idempotent on 404)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true })               // DELETE /routes/rt-1
      .mockResolvedValueOnce({ ok: false, status: 404 }) // DELETE /services/svc-1 already gone
    const kong = new KongAdminClient('http://kong:8001', fetchMock as any)
    await expect(kong.deleteTenantRoute({ serviceId: 'svc-1', routeId: 'rt-1' })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行确认失败** — `cd iam && pnpm vitest run kong-admin`
- [ ] **Step 3: 实现 `KongAdminClient`**
  - `createTenantRoute`：`POST /services {url, name:`tenant-<org>`, tags:['tenant',`org:<org>`]}` → `POST /routes {service:{id}, hosts:[domain], tags:[...]}` → 返回 ids。
  - `attachPlugin(routeId, name, config)`：`POST /routes/{id}/plugins`（用于挂租户级 rate-limiting/cors）。
  - `deleteTenantRoute`：先删 route 再删 service；404 视为幂等成功。
  - orgId/domain 经标识符白名单校验（防注入到 URL/tag）。
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: 集成测试（真实 Kong）** — 新增 `kong-admin.integration.test.ts`：对本地 DB-mode Kong 真正建 service+route，`GET /routes?tags=org:acme` 可查到，删除后查不到。
- [ ] **Step 6: Commit**

---

## Phase 3：子系统部署清单与库迁移（与网关无关，保持）

### Task 4：部署清单渲染（dedicated / shared）

**Files:**
- Create: `iam/templates/subsystem.compose.eta`, `iam/provisioner/src/deploy/manifest-renderer.ts`
- Test: `iam/provisioner/src/deploy/__tests__/manifest-renderer.test.ts`

- [ ] **Step 1: 写失败测试** — `renderManifest({ orgId, tier:'dedicated', databaseUrl, logto })` 产出含 `ORG_ID`/`DATABASE_URL`/`LOGTO_ENDPOINT`/`LOGTO_APP_ID` 注入的 compose；`tier:'shared'` 返回 `{ shared: true }` 不渲染独立 service。机密用 env 占位、不明文落盘。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

### Task 5：子系统库迁移执行器

**Files:**
- Create: `iam/provisioner/src/deploy/subsystem-migrator.ts`
- Test: `iam/provisioner/src/deploy/__tests__/subsystem-migrator.test.ts`（集成，真实 Postgres）

- [ ] **Step 1: 写失败测试** — `migrateTenantDatabase(databaseUrl, schemaPath)` 对空业务库执行 `prisma migrate deploy`，断言 `_prisma_migrations` 与关键表存在；重复幂等。schema 用最小 fixture。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**（注入 `DATABASE_URL` 调 `prisma migrate deploy --schema <path>`，非零退出抛 `MigrationError`）
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

### Task 6：Deployer 抽象

**Files:**
- Create: `iam/provisioner/src/deploy/deployer.ts`
- Test: `iam/provisioner/src/deploy/__tests__/deployer.test.ts`

- [ ] **Step 1: 写失败测试** — `Deployer` 接口（`deploy(orgId, manifestPath)`/`teardown(orgId)`）；`NoopDeployer` 记录调用；`ComposeDeployer` 通过可注入 `run` 构造 `-p tenant-<org>` 命令但不真执行。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

---

## Phase 4：编排集成与回收

### Task 7：扩展开通编排（含逆向回滚）

**Files:**
- Modify: `iam/provisioner/src/provision-tenant.ts`
- Test: `iam/provisioner/src/__tests__/provision-tenant.test.ts`（追加）

- [ ] **Step 1: 写失败测试**（mock 全部副作用模块）：
  - happy path 顺序：`createOrganization → provisionDatabase → migrateTenantDatabase → kong.createTenantRoute → deployer.deploy → registry.upsert(active)`，返回含 `domain`、`kongServiceId`、`kongRouteId`。
  - 回滚矩阵（逐阶段失败各一条）：任一阶段抛错时逆序补偿（`deployer.teardown` → `kong.deleteTenantRoute` → `deprovisionDatabase` → `deleteOrganization`），注册表标记 `failed`。

```ts
it('deletes kong route and database when deploy fails', async () => {
  const deps = makeDeps()
  deps.deployer.deploy.mockRejectedValueOnce(new Error('compose failed'))
  await expect(provisionTenant({ name: 'acme', ownerUserId: 'u1', tier: 'dedicated' }, deps))
    .rejects.toThrow(/compose failed/)
  expect(deps.kong.deleteTenantRoute).toHaveBeenCalledWith({ serviceId: 'svc-1', routeId: 'rt-1' })
  expect(deps.db.deprovisionDatabase).toHaveBeenCalled()
  expect(deps.org.deleteOrganization).toHaveBeenCalledWith('org-id')
})
```

- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现** — 把 Kong 阶段插入 Plan 1 的补偿栈（每完成一步 push 一个 undo 闭包，失败逆序执行）。
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

### Task 8：解除开通（DELETE 全链路回收）

**Files:**
- Modify: `iam/provisioner/src/provision-tenant.ts`（`deprovisionTenant`）、`iam/provisioner/src/http.ts`
- Test: 追加

- [ ] **Step 1: 写失败测试** — `deprovisionTenant(orgId)` 依注册表逆序回收（teardown→deleteTenantRoute→deprovisionDatabase→deleteOrganization→registry.markDeprovisioned）；对不存在 org 幂等成功。
- [ ] **Step 2: 运行确认失败**
- [ ] **Step 3: 实现**
- [ ] **Step 4: 运行确认通过**
- [ ] **Step 5: Commit**

---

## 端到端验收（本地 DB-mode Kong 冒烟，全过即 Plan 2 完成）

- [ ] **A1**：通配本地域名（`/etc/hosts` 加 `acme.example.com beta.example.com`）就绪；`deck gateway diff` 对 base 显示 0 变更
- [ ] **A2**：`POST /tenants {name:'acme', tier:'dedicated', ownerUserId}` 成功；Kong Admin `GET /routes?tags=org:acme` 查到一条路由；`runtime/tenants/acme/` 生成 compose
- [ ] **A3**：`curl -H 'Host: acme.example.com' http://localhost/healthz` 命中该组织子系统（占位 echo 服务验证路由打通）
- [ ] **A4**：`psql` 确认 `tenant_acme` 库已执行 fixture 迁移（`_prisma_migrations` 有记录）
- [ ] **A5**：`POST /tenants {name:'beta', tier:'shared'}` 不创建独立 service 容器，但 `beta.example.com` 经 Kong 路由到共享子系统
- [ ] **A6**：故意令 deploy 阶段失败，确认 Kong route+service、业务库、Logto org 全部被回收（`GET /routes?tags=org:acme` 空），注册表 `failed`
- [ ] **A7**：`DELETE /tenants/acme` 后 Kong 路由消失、库删除、Logto org 删除，`curl -H 'Host: acme.example.com'` 返回 404
- [ ] **A8（安全）**：从容器外网（非 127.0.0.1 / 非内网）访问 `:8001` Admin API 失败/不可达（ADR-0007）
- [ ] **A9**：`cd iam && pnpm test` 全绿；`git status` 仅含 `iam/`（仍未触碰 ray 应用代码）

---

## 显式不在本计划范围

- DNS-01 通配证书（`*.example.com`）——默认用 acme 按需 http-01，DNS-01 留作 Plan 2.1
- 真实 K8s 部署（本计划用 `ComposeDeployer`；`K8sDeployer` 同接口留作增量）
- Kong Admin API 的认证加固（mTLS / RBAC 企业版）——本计划靠内网隔离（ADR-0007），生产可叠加
- ray 应用接入 Logto（Plan 3）；其中 `/api/auth` 路由从 base.yml 移除在 Plan 3 处理
```
