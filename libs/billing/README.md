# `@libs/billing`

`ray` 的统一计费域库。**计费 provider 是确定性的**：Web 端固定使用 **Stripe**，移动端固定使用 **RevenueCat**。本库不做多 provider 适配，只做必要的 SDK 封装与数据同步。

## 模块划分

- `billing-contract`：类型、状态常量和传输记录
- `billing-config`：纯套餐目录、价格和权益计算
- `billing-client`：owner-scoped HTTP query/mutation 与 payload 校验
- `server`：Prisma 持久化 helper、billing customer / subscription / order /
  webhook event 读写，以及 RevenueCat S2S webhook
- `web`：Stripe Checkout / Billing Portal / Webhook
- `mobile`：RevenueCat Provider / `useCustomer` / `usePaywall`

## 导出入口

| 入口 | 内容 |
| --- | --- |
| `@libs/billing-contract` | 运行时无关的计费类型、状态常量和传输记录 |
| `@libs/billing-config` | 纯套餐目录构建器、价格与权益计算；不读取环境变量 |
| `@libs/billing-client` | 通用 HTTP/query adapter；Query Key 包含 owner kind 和 user ID |
| `@libs/billing` | 兼容 facade：套餐配置、env preset、工具函数，并暂时转发 contract |
| `@libs/billing/web` | Stripe checkout / portal / webhook 实现 |
| `@libs/billing/server` | Prisma helper + `handleRevenueCatWebhook` |
| `@libs/billing-native` | `Provider`、`useCustomer`、`usePaywall`（基于 RevenueCat SDK） |

新代码应从 `@libs/billing-contract` 导入类型和状态常量。旧
`@libs/billing` 类型导出保留一个发布周期，只用于迁移回退；Stripe、
RevenueCat、Prisma 和环境读取不会进入 contract 项目。
目录中的 Stripe Price ID 和 RevenueCat Product ID 由各运行时适配器注入，
不会进入 `billing-config` 的默认 universal 配置。

## 环境变量

### Web / Server

```bash
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
REVENUECAT_API_KEY=rcb_xxx
REVENUECAT_WEBHOOK_SECRET=whsec_rc_xxx

VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
VITE_BILLING_STRIPE_PRICE_PREMIUM_LIFETIME=price_xxx
VITE_BILLING_STRIPE_PRICE_PREMIUM_MONTHLY=price_xxx
VITE_BILLING_STRIPE_PRICE_PREMIUM_YEARLY=price_xxx
```

### Mobile

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_xxx
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_xxx
EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_LIFETIME=ray_premium_lifetime
EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_MONTHLY=ray_premium_monthly
EXPO_PUBLIC_REVENUECAT_PRODUCT_PREMIUM_YEARLY=ray_premium_yearly
```

## Web 使用方式

```ts
import {
  createStripeBillingPortalSession,
  createStripeCheckoutSession,
  handleStripeWebhook
} from '@libs/billing/web'

const checkout = await createStripeCheckoutSession({
  referenceId: user.id,
  email: user.email,
  variantId: 'premium-monthly',
  successUrl: 'https://app.example.com/billing/success',
  cancelUrl: 'https://app.example.com/pricing'
})

const portal = await createStripeBillingPortalSession({
  referenceId: user.id,
  email: user.email,
  returnUrl: 'https://app.example.com/settings/billing'
})

await handleStripeWebhook({
  payload: rawBody,
  signature: request.headers['stripe-signature'] as string
})
```

`billing/checkout` 与 `billing/portal` 的 request 校验统一由 `@libs/payload` 提供。

## Mobile 使用方式

`@libs/billing-native` 直接暴露 RevenueCat 实现，无运行时注册步骤。旧的
`@libs/billing/mobile` 仅保留为一个发布周期的回退 facade。

```tsx
import { Provider, useCustomer, usePaywall } from '@libs/billing-native'

export function BillingProvider({ children }: { children: React.ReactNode }) {
  return <Provider locale={locale}>{children}</Provider>
}

function UpgradeButton() {
  const { present } = usePaywall({
    onPurchase: () => console.log('purchased'),
    onDismiss: () => console.log('dismissed')
  })

  return <Button onPress={() => present({ trigger: 'premium' })}>Upgrade</Button>
}

function MembershipBadge() {
  const { entitlements } = useCustomer()
  const active = entitlements.find(item => item.active)
  return <Text>{active ? active.id : 'free'}</Text>
}
```

## 数据库

`libs/pg-dao/src/models/billing.prisma` 提供以下模型：

- `BillingCustomer`
- `BillingSubscription`
- `BillingOrder`
- `BillingWebhookEvent`

## 验证

```bash
pnpm exec prisma generate --schema libs/pg-dao/src/schema.prisma
pnpm nx run billing:lint
pnpm nx run billing:typecheck
pnpm nx run billing:test
```
