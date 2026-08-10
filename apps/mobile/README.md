# `apps/mobile`

`ray` 的 Expo / React Native 客户端，完整覆盖 setup / dashboard 业务链路：

- `setup`：欢迎、登录、注册、多步引导
- `dashboard`：用户与组织双 Tab 体系
- `billing`：基于 `@libs/billing-native` 的 RevenueCat 订阅 / 一次性购买与 Paywall
- `analytics` / `monitoring`：PostHog + Sentry 真实 SDK 集成

> 详细的环境准备、证书申请、商店发布流程见 [`./GUIDE.md`](./GUIDE.md)。本文档只回答一个问题：
>
> **「我现在要做 X，应该敲哪条命令？」**

---

## 四种场景速查

所有命令均从 **仓库根目录** 执行（不是 `apps/mobile`），统一通过 `pnpm` 调度 Nx + Expo。命令的具体参数（`--device`、`--configuration Release`、`--profile production` 等）都封装在 [`apps/mobile/project.json`](./project.json) 的 target / configuration 里，根 `package.json` 只保留入口名，方便统一维护。

| # | 场景 | 命令 | 用途 | 是否需要原生编译 |
|---|------|------|------|------------------|
| ① | 纯 JS / HMR 调试      | `pnpm dev:mobile`              | 启动 Metro、按 `i`/`a` 唤起已装的 dev client，秒级 Fast Refresh | 否（前提是真机/模拟器已装过 dev client） |
| ② | 真机 debug 调试       | `pnpm mobile:ios` / `pnpm mobile:android` | 在真机上重新编译 debug 原生壳并安装，自动连 Metro 拿 HMR | 是（首次几分钟） |
| ③ | 真机 release 验证      | `pnpm mobile:ios:release` / `pnpm mobile:android:release` | 在真机上本地编译 release 包跑一遍，验证发布版的体积、性能、崩溃 | 是（release 编译更慢） |
| ④ | 商店发布（EAS 云端）  | `pnpm mobile:release:ios` / `pnpm mobile:release:android` | 触发 `eas build --profile production`，云端生成可上架的 `.ipa` / `.aab` | 否（云端构建） |

> 经验建议：**日常开发用 ① + ②；准备打 tag 之前用 ③ 真机过一遍；提审才用 ④。**

---

## 场景详解

### ① 快速 HMR — `pnpm dev:mobile`

```bash
pnpm dev:mobile          # = dotenv -e .env.local -- nx run mobile:start
```

- 只启动 Metro（`expo start`），**不会**重新编译原生壳。
- 适用前提：目标设备 / 模拟器**已经安装过任意一个 development build**（Expo Dev Client）。
- 启动后终端按键：`i` 唤起 iOS 模拟器，`a` 唤起 Android 模拟器，`r` 重载，`j` 打开 RN DevTools。
- 改 JS / TSX / 样式 → 保存即热更新；改原生代码 / 新增 native module → 必须走 ②。
- HMR 默认开启，无需额外配置。

> 第一次给一台新真机 / 模拟器装 dev client，请先跑一次 ②。后续每天都可以只跑 ①。

### ② 真机 debug — `pnpm mobile:ios` / `pnpm mobile:android`

```bash
pnpm mobile:ios          # = expo run:ios --device
pnpm mobile:android      # = expo run:android --device
```

- 在 USB 连接的**真机**上重新编译一个 debug 版本的原生壳并安装。
- iOS：会弹出设备选择列表，按方向键选；首次需要 Xcode 配好签名（GUIDE.md §2.1）。
- Android：依赖 `adb devices` 能列出你的真机，需开启「USB 调试」。
- 装上后 app 自动连 Metro，**自带 Fast Refresh / HMR**，与 ① 体验一致。
- 适合：
  - 第一次给真机装 dev client；
  - 调试只在真机能复现的功能（相机、推送、IAP、生物识别等）；
  - 改了 `app.config.ts` 里的 plugin / `package.json` 里的原生依赖。

> 不想接 USB？先跑一次本场景把 dev client 装上，之后只用 ① + 局域网即可。

### ③ 真机 release 验证 — `pnpm mobile:ios:release` / `pnpm mobile:android:release`

```bash
pnpm mobile:ios:release      # = expo run:ios --device --configuration Release
pnpm mobile:android:release  # = expo run:android --device --variant release
```

- 仍然在你本机上编译并装到真机，但走 **release 配置**：JS minify、Hermes 字节码、移除 DevMenu、Sentry release sourcemap 等。
- 用来在提交 EAS 之前**手动验证 release 体验**，例如：
  - 真实启动耗时与冷启动闪屏；
  - 动画在 Hermes 下是否掉帧；
  - 关闭 DevMenu 后崩溃是否能正确捕获；
  - 打包后体积是否符合预期。
- 注意：release 包**不会**连接 Metro，没有 HMR；改代码必须重新跑一次。
- iOS release 必须使用付费 Apple Developer 账号的签名（不能用 Personal Team）。

### ④ 商店发布构建 — `pnpm mobile:release:ios` / `pnpm mobile:release:android`

```bash
pnpm mobile:release:ios       # = eas build --profile production --platform ios --non-interactive
pnpm mobile:release:android   # = eas build --profile production --platform android --non-interactive
```

- 走 EAS 云端构建（profile 见 `apps/mobile/eas.json` 中的 `production`）。
- 产物：iOS `.ipa`（App Store Connect 可直接上传）、Android `.aab`（Google Play 可直接上传）。
- 环境变量来自 `eas.json` `build.base.env`，不读你本机的 `.env.local`，所以**生产用的密钥要在 EAS Secret 里配置**。
- 第一次跑前需要本机登录 EAS：`pnpm dlx eas-cli login`。
- 构建完成后：
  - 上传到商店：`pnpm dlx eas-cli submit --platform ios|android`（或在 EAS 面板里点）。
  - OTA 热更：`pnpm dlx eas-cli update --branch production --message "<改动描述>"`，仅改 JS / 资源时生效。

---

## 关键环境变量（开发态，仓库根 `.env.local`）

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_SITE_URL=http://localhost:3000
EXPO_PUBLIC_DEFAULT_LOCALE=zh

EXPO_PUBLIC_ANALYTICS_PROVIDER=posthog
EXPO_PUBLIC_MONITORING_PROVIDER=sentry

EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxx
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxx
EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_LIFETIME=ray_premium_lifetime
EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_MONTHLY=ray_premium_monthly
EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_YEARLY=ray_premium_yearly
```

说明：

- 场景 ① ② ③ 的命令都通过 `dotenv -e .env.local --` 注入这些变量；④ 走 EAS 云端，不读 `.env.local`，对应的生产值请配置到 `apps/mobile/eas.json` 或 EAS Secrets。
- 移动端计费固定使用 RevenueCat（`@libs/billing-native`），无需运行时切换 provider。
- PostHog / Sentry / RevenueCat 的 provider 在 `src/lib/{analytics,monitoring,providers/billing}.tsx` 中直接注册对应 SDK。

---

## 直接进入 app 目录的等价命令

```bash
pnpm --filter mobile dev                           # ≈ pnpm dev:mobile
pnpm --filter mobile exec expo run:ios --device    # ≈ pnpm mobile:ios
pnpm --filter mobile exec expo run:android --device# ≈ pnpm mobile:android
pnpm --filter mobile exec eas build --profile production --platform ios|android   # ≈ pnpm mobile:release:*
```

---

## 验证

```bash
pnpm --filter mobile typecheck
pnpm --filter mobile exec expo export --platform ios --platform android
```

或一条命令跑完两步：

```bash
pnpm verify:mobile
```
