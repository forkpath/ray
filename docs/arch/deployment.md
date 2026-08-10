# 部署指南

## 架构概览

```
                    ┌──────────────────┐
    Client ───────► │  Kong :80/:443   │
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
         /api/* │                    /* (other)
                ▼                         ▼
        ┌──────────────┐         ┌──────────────┐
        │ Engine :8000 │         │  Web  :3000  │
        │   (NestJS)   │         │ (TanStack SSR│
        └──────┬───────┘         └──────────────┘
               │
  ┌────────────┼────────────┐
  ▼            ▼            ▼
PostgreSQL   MongoDB      Redis
 :5432       :27017       :6379
```

- Kong 作为 API 网关 / 反向代理，自动管理 HTTPS 证书
- `http://` 和 `www.` 开头的请求全部 301 到 `https://裸域名`
- `/api/*` → Engine（NestJS）
- `/*` → Web（TanStack Start SSR + SPA）

## 更新策略

每次部署**仅重建和重启 engine、web**，基础设施容器不受影响。

```
┌─────────────────────────────────────────────────────┐
│  基础设施（首次启动后不再变动）                         │
│  redis:7.4 · postgres:17 · mongo:8.0               │
│  rabbitmq:4.0.1 · kong:3.9 · konga                 │
│  ↕ 持久化卷: ray-redis, ray-postgres, ray-mongo …   │
├─────────────────────────────────────────────────────┤
│  应用（每次部署重建）                                  │
│  engine · web                                       │
└─────────────────────────────────────────────────────┘
```

---

## 首次部署

### 前置条件

- 一台 Linux 服务器（推荐 Ubuntu 22.04+），已安装 Docker 和 Docker Compose
- Git 已安装
- Node.js >= 24.0.0 和 pnpm >= 10.25.0 已安装（用于宿主机 Nx 构建）
- 域名已购买，DNS 能配置 A 记录

### 步骤 1：克隆代码

```bash
sudo mkdir -p /opt/ray && sudo chown $(whoami) /opt/ray
git clone <repo-url> /opt/ray
cd /opt/ray
```

### 步骤 2：配置环境变量（唯一需要手动编辑的环节）

```bash
cp .env.example .env
vim .env
```

**必须修改的变量：**

| 变量                          | 示例值               | 说明                                 |
| ----------------------------- | -------------------- | ------------------------------------ |
| `DOMAIN`                      | `postfly.io`         | 生产域名，Kong ACME 插件用此申请证书 |
| `ACME_EMAIL`                  | `admin@postfly.io`   | Let's Encrypt 通知邮箱               |
| `VITE_URL`                    | `https://postfly.io` | 前端访问 URL                         |
| `VITE_PRODUCT_NAME`           | `Postfly`            | 产品名称                             |
| `BETTER_AUTH_SECRET`          | 随机 32+ 字符        | Session token 签名密钥               |
| `BETTER_AUTH_URL`             | `https://postfly.io` | Better Auth 回调地址                 |
| `CORS_ORIGINS`                | `https://postfly.io` | 允许跨域的前端域名                   |
| `POSTGRES_PASSWORD`           | 强密码               | PostgreSQL 密码                      |
| `REDIS_PASSWORD`              | 强密码               | Redis 密码                           |
| `MONGO_INITDB_ROOT_PASSWORD`  | 强密码               | MongoDB 密码                         |
| `STRIPE_SECRET_KEY`           | `sk_live_xxx`        | Stripe 服务端密钥                    |
| `STRIPE_WEBHOOK_SECRET`       | `whsec_xxx`          | Stripe Webhook 签名密钥              |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_xxx`        | Stripe 前端公钥                      |
| OAuth 相关                    | 各平台密钥           | Google / GitHub / Apple 登录         |

**环境变量在各阶段的使用方式：**

| 变量类型                                   | 使用时机           | 说明                                                       |
| ------------------------------------------ | ------------------ | ---------------------------------------------------------- |
| `VITE_*`                                   | 宿主机 Nx 构建阶段 | Vite 在构建时读取 `process.env.VITE_*` 写入前端 JS         |
| `VITE_*`                                   | 容器运行时         | envin (Zod) 在 SSR 服务器启动时通过 `process.env` 读取校验 |
| `DOMAIN` / `ACME_EMAIL` / `REDIS_PASSWORD` | Kong 启动时        | `entrypoint.sh` 渲染 `kong.yml` 模板                       |
| 其余所有变量                               | 容器运行时         | `env_file: ../.env` 从仓库根目录注入到容器                 |

> **注意：** Web 容器也需要 `BETTER_AUTH_SECRET` 等服务端变量，因为 SSR 服务器执行
> auth 逻辑时 envin 会校验这些值。如果缺失，SSR 服务器启动即崩溃
> (`EnvError: Invalid environment variables`)。这就是 web 服务和 engine 共用仓库根目录
> `.env` 的原因。

### 步骤 3：启动基础设施

```bash
./scripts/deploy.sh infra
```

启动 Redis、PostgreSQL、MongoDB、RabbitMQ，等待 healthcheck 全部通过。

### 步骤 4：构建并启动应用

```bash
./scripts/deploy.sh build    # 宿主机 Nx 构建 → 打包为 Docker 镜像
./scripts/deploy.sh up       # 启动全部服务（含 Kong、Konga）
```

`build` 命令会执行：

1. `pnpm install` — 安装依赖（lockfile 未变时自动跳过）
2. `nx run-many web:build + engine:build` — 并行打包，产物分别在 `dist/apps/web/` 和 `dist/services/engine/`
3. 验证构建产物完整性
4. `docker compose build` — 将构建产物打包成轻量级 Docker 镜像

### 步骤 5：数据库迁移

```bash
./scripts/deploy.sh migrate
```

### 步骤 6：配置 DNS

在域名服务商处添加以下记录：

| 记录类型 | 主机记录 | 记录值    |
| -------- | -------- | --------- |
| A        | `@`      | 服务器 IP |
| A        | `www`    | 服务器 IP |

DNS 生效后，首次通过 `https://postfly.io` 访问时，Kong ACME 插件会自动向 Let's Encrypt 申请证书。

### 步骤 7：配置 GitHub Actions 自动部署（可选）

在 GitHub 仓库设置中添加 Secrets：

| Secret           | 说明             |
| ---------------- | ---------------- |
| `DEPLOY_HOST`    | 服务器 IP 或域名 |
| `DEPLOY_USER`    | SSH 用户名       |
| `DEPLOY_SSH_KEY` | SSH 私钥         |

生成部署专用密钥对：

```bash
# 本地机器
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/ray-deploy

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/ray-deploy.pub user@server

# 将私钥内容复制到 GitHub Secrets → DEPLOY_SSH_KEY
cat ~/.ssh/ray-deploy
```

可选的 GitHub Variables：

| Variable      | 默认值     | 说明               |
| ------------- | ---------- | ------------------ |
| `DEPLOY_PORT` | `22`       | SSH 端口           |
| `DEPLOY_PATH` | `/opt/ray` | 服务器上的项目路径 |

---

## 日常更新

### 方式一：手动（在服务器上执行）

```bash
cd /opt/ray
./scripts/deploy.sh          # git pull → 重建 engine+web → 重启
./scripts/deploy.sh migrate  # 如果数据库 schema 有变更
```

### 方式二：自动（推荐）

在本地 main 分支上打 tag 并推送：

```bash
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions 会自动：

1. 验证 tag 在 main 分支上（其他分支的 tag 会被拒绝）
2. SSH 到服务器
3. `git checkout v1.0.1`
4. 执行 `./scripts/deploy.sh update`（仅重建 engine + web）

---

## deploy.sh 命令参考

| 命令             | 说明                                           |
| ---------------- | ---------------------------------------------- |
| `update`（默认） | `git pull` → 重建 engine+web → 重启 engine+web |
| `build`          | 仅构建 engine+web 镜像                         |
| `up`             | 启动全部服务                                   |
| `restart`        | 仅重启 engine+web（不重新构建）                |
| `down`           | 停止全部服务（数据卷保留）                     |
| `infra`          | 仅启动基础设施                                 |
| `logs [service]` | 查看日志（默认 engine + web）                  |
| `status`         | 查看容器运行状态                               |
| `migrate`        | 执行 Prisma 数据库迁移                         |

---

## 什么时候需要改环境变量？

| 场景                          | 操作                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| 日常发版                      | **不需要**动 `.env`                                                                                 |
| 换域名                        | 改 `DOMAIN`、`VITE_URL`、`BETTER_AUTH_URL`、`CORS_ORIGINS`，然后 `deploy.sh build` + `deploy.sh up` |
| 改 Stripe 密钥                | 改对应的 `STRIPE_*` / `VITE_STRIPE_*`，然后 `deploy.sh build` + `deploy.sh up`                      |
| 加新的 OAuth 提供商           | 加对应密钥，`deploy.sh restart`（不需要 rebuild）                                                   |
| 改数据库密码                  | 改密码后 `deploy.sh down` + `deploy.sh up`（基础设施也需重启）                                      |
| 仅改服务端变量（非 `VITE_*`） | 改完后 `deploy.sh restart` 即可                                                                     |
| 改 `VITE_*` 变量              | 必须 `deploy.sh build` + `deploy.sh up`（需要重新 Nx 构建写入前端 JS）                              |

---

## 构建架构

遵循 **Nx 官方最佳实践**：宿主机构建 + Docker 运行时打包。

```
宿主机（有 Node.js + pnpm）              Docker（仅运行时）
┌──────────────────────────────┐        ┌──────────────────┐
│  pnpm install                │        │  COPY dist/      │
│                              │        │    apps/web/     │
│  nx run-many (parallel)      │──────► │  node            │  web 镜像
│  → dist/apps/web/            │        │    server/       │
│    server/index.mjs          │        │    index.mjs     │
│    public/                   │        └──────────────────┘
│                              │        ┌──────────────────┐
│  → dist/services/engine/     │        │  COPY dist/      │
│    main.js + package.json    │──────► │  COPY .npmrc     │  engine 镜像
│                              │        │  pnpm install    │
│  pnpm nx run engine:package  │        │  node main.js    │
│  → pnpm-lock.yaml (pruned)  │        └──────────────────┘
└──────────────────────────────┘
```

**为什么不在 Docker 内运行 Nx 构建？**

Nx 的 `nx run` 命令在执行任何任务前，必须先加载全部插件计算项目图。
`@nx/vitest` 等插件会评估 `vite.config.mts`，触发文件监听器，在 Docker BuildKit
的受限环境下容易命中 inotify 限制、缺少 `.npmrc`、缺少 git 等一系列问题。
宿主机构建完全规避了这些问题，且 Docker 镜像更小、构建更快。

### Web（`docker/web.Dockerfile`）

运行时镜像，仅包含 Nitro 自包含的 SSR 服务器。

- **宿主机产物**：`dist/apps/web/`（Nitro node-server preset 打包，含所有依赖）
- **运行**：`node server/index.mjs`，无需 `node_modules`
- **镜像体积**：约 50MB
- `VITE_*` 变量在宿主机构建时由 Vite 读取 `process.env` 写入前端 JS

### Engine（`docker/engine.Dockerfile`）

运行时镜像，包含 webpack bundle + 外部依赖。

- **宿主机产物**：`dist/services/engine/`
  - `main.js` — webpack bundle（源码已打包，`node_modules` 保持外部引用）
  - `package.json` — `generatePackageJson: true` 自动生成，仅含外部依赖
  - `pnpm-lock.yaml` — `engine:package` 通过固定依赖中的 Nx `createLockFile` API，
    从宿主机根 lockfile 中裁剪出匹配该 `package.json` 的版本
- **运行**：`pnpm install --frozen-lockfile --prod` + `node main.js`
- Docker 内使用 **pnpm**（与宿主机一致），通过裁剪版 lockfile 确保依赖解析确定性
- 环境变量在**运行时**通过 `ConfigService` 读取

> **注意**：engine 的 `tsconfig.app.json` 设置了 `importHelpers: false`，
> TypeScript 辅助函数直接内联到代码中，避免运行时依赖 `tslib`。

---

## Kong 配置

Kong 以 **DB-less 模式**运行，声明式配置位于 `docker/kong/kong.yml`。

### 路由规则

| 优先级 | 路径          | 上游          |
| ------ | ------------- | ------------- |
| 1      | `/api/auth/*` | `engine:8000` |
| 2      | `/api/*`      | `engine:8000` |
| 3      | `/*`          | `web:3000`    |

### HTTPS 与 Let's Encrypt

Kong 使用内置的 **ACME 插件**自动申请和续期 Let's Encrypt 证书。

- 证书存储在 Redis（database 1），到期前 30 天自动续期
- 同时为裸域名和 `www.` 子域名申请证书

**请求处理流程：**

| 访问方式                   | 结果                         |
| -------------------------- | ---------------------------- |
| `http://postfly.io/*`      | 301 → `https://postfly.io/*` |
| `http://www.postfly.io/*`  | 301 → `https://postfly.io/*` |
| `https://www.postfly.io/*` | 301 → `https://postfly.io/*` |
| `https://postfly.io/*`     | 正常处理                     |

**工作原理：**

1. Kong 启动时，`docker/kong/entrypoint.sh` 将 `${DOMAIN}`、`${ACME_EMAIL}`、`${REDIS_PASSWORD}` 替换到配置模板中
2. Kong 监听 80（HTTP）和 443（HTTPS）
3. 首次 HTTPS 请求触发 Let's Encrypt 证书申请
4. 后续 HTTP / www 请求自动 301 跳转
5. ACME 插件自动续期

### Konga 管理 UI

通过 `http://<server-ip>:1337` 访问 Konga 管理界面。
连接 Kong Admin API 地址：`http://kong:8001`。

---

## 文件结构

```
.env                            # 环境变量（本地开发与生产共用路径，不入 git）
docker/
├── docker-compose.yml          # 服务编排
├── docker-compose.dev.yml      # 本地基础设施（redis / postgres / mongo / rabbitmq）
├── web.Dockerfile              # Web 镜像构建
├── engine.Dockerfile           # Engine 镜像构建
├── kong/
│   ├── kong.yml                # Kong 配置模板（含 ${DOMAIN} 等占位符）
│   └── entrypoint.sh           # Kong 启动前的模板渲染脚本
└── mongo/
    └── init-db.js              # MongoDB 初始化脚本

scripts/
├── deploy.sh                   # 部署脚本
├── create-service-lockfile.js  # 为服务生成裁剪版 pnpm-lock.yaml
└── create-engine-lockfile.js   # 旧 engine 入口的兼容 facade

.github/workflows/
└── deploy.yml                  # 自动部署 workflow（tag 触发）
```
