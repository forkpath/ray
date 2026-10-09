# extension

## 用途

WXT 浏览器扩展，包含 popup/content/background 交互，使用 Web 认证、API 和监控。

## Tags、使用者与场景

`type:app` · `runtime:web` · `domain:composition`。

Chrome/Firefox 用户；通过浏览器加载扩展产物，不能由其他库导入此 app。

依赖同时受 type/runtime/domain 限制，详见[根目录规则](../../docs/architecture/ray-framework-nx-guide.md#公共入口与运行时)。仅通过已声明 public API 使用，不跨项目相对路径导入源码。

## 环境变量与配置来源

`src/lib/env.ts` 读取 VITE_URL（站点地址）、VITE_API_BASE_URL（Engine）、VITE_DEFAULT_LOCALE/VITE_THEME_MODE/VITE_THEME_COLOR（UI 设置），均由根 .env/部署构建提供；wxt.config.ts 根据 MODE/NODE_ENV 加载根 env。监控使用 VITE_SENTRY_EXTENSION_DSN 与 VITE_SENTRY_ENVIRONMENT（Sentry 后台/环境名），埋点用 VITE_POSTHOG_KEY/HOST。公开配置不要放 token/secret。

| 变量                                     | 含义                            | 何时配置/默认                                                          | 值从哪里来                                    |
| ---------------------------------------- | ------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `API_BASE_URL`                           | SSR 默认 API 地址               | 默认 http://localhost:8000                                             | SSR 可达的 Engine 地址；显式 baseURL 参数优先 |
| `VITE_API_BASE_URL`                      | Desktop/Extension 默认 API 地址 | 默认 http://localhost:8000                                             | 客户端可达 Engine 地址；显式 baseURL 参数优先 |
| `EXPO_PUBLIC_API_BASE_URL`               | Mobile 默认 API 地址            | 默认 http://localhost:8000                                             | 手机可达 Engine 地址；推荐宿主静态读取后传参  |
| `VITE_ANALYTICS_PROVIDER`                | 分析 provider 选择              | 默认 posthog；schema 也接受 google-analytics，是否有实现需看 providers | 开发者选择；native 不应据 enum 推断有 GA 实现 |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | PostHog 项目 key/接收端点       | 启用 PostHog 时填写 key；host 默认 https://us.i.posthog.com            | PostHog 项目设置                              |
| `VITE_GOOGLE_ANALYTICS_MEASUREMENT_ID`   | GA4 Measurement ID              | 启用 GA 时配置                                                         | GA4 数据流设置                                |

依赖配置：[auth-client-web](../../libs/auth-client-web/README.md)、[monitoring-web](../../libs/monitoring-web/README.md)。只在实际启用对应路径时提供厂商配置，不把服务端密钥放到客户端。

读取/配置定义：[src/lib/env.ts](src/lib/env.ts)。

加载时机、dotenv wrapper 和秘密管理见[环境指南](../../docs/development/environment.md)。本表未包含真实凭据。

## 运行与构建

所有命令从仓库根执行：

```sh
pnpm nx show project extension --json
pnpm dev:extension
pnpm nx run extension:build
pnpm nx run extension:lint
pnpm nx run extension:typecheck
```

`pnpm nx run extension:dev-firefox` 开发 Firefox；`pnpm nx run extension:build` 聚合 Chrome/Firefox 打包，产物目录 build/.output；不要将生成 ZIP 当作商店已发布。

## 单元测试：运行与编写

```sh
pnpm nx run extension:test
pnpm nx run extension:typecheck-tests
```

使用 Vitest、jsdom 与 WXT 官方 fake browser。用例放在 `tests/**/*.spec.ts` / `*.spec.tsx`，覆盖消息、存储竞争和错误边界，不读取开发者 `.env`。报告在 `dist/test-results/extension/unit`；browser API mock 不证明真实扩展权限与进程通信。

## E2E：运行与编写

```sh
pnpm exec playwright install chromium
pnpm nx run extension:e2e
```

自动构建独立测试产物并加载到真实 Chromium，验证五个页面、background messaging、content script、storage 和重载。新用例放在 `e2e/`，复用 `fixtures.ts` 的独立 profile 与失败诊断。外部认证 HTTP 使用受控响应，扩展进程通信和存储保持真实。

`extension:smoke` 保留生产配置构建验证；`extension:e2e-artifact` 验证已解压的发布 ZIP，详见 [测试指南](../../docs/development/testing.md#extension-真实浏览器测试)。Firefox 当前只有构建验证，未计作真实扩展运行通过。
