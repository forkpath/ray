# 新增业务模块：权限与鉴权接入指南

本文档面向前后端开发人员，说明在项目中新增一个业务模块时，从权限声明、数据库变更、前端路由/菜单鉴权到后端接口鉴权的完整流程。

以「新增一个 **Warehouse（仓库）** 模块」为例进行演示。

---

## 目录

- [整体流程概览](#整体流程概览)
- [Step 1：声明权限资源](#step-1声明权限资源)
- [Step 2：为预定义角色分配权限](#step-2为预定义角色分配权限)
- [Step 3：数据库变更](#step-3数据库变更)
- [Step 4：注册前端路由](#step-4注册前端路由)
- [Step 5：配置前端菜单与鉴权](#step-5配置前端菜单与鉴权)
- [Step 6：后端接口鉴权](#step-6后端接口鉴权)
- [Step 7：动态角色管理](#step-7动态角色管理)
- [Step 8：重启与部署注意事项](#step-8重启与部署注意事项)
- [Checklist](#checklist)

---

## 整体流程概览

```
permissions.ts     前端路由/菜单         后端接口
  (声明资源)    (beforeLoad 鉴权)  (@RequirePermissions)
      │                │                  │
      ▼                ▼                  ▼
┌──────────┐    ┌──────────────┐    ┌───────────────┐
│ Resource │    │ pathsConfig  │    │  Controller   │
│ + Action │    │ + nav-config │    │  + Decorator  │
│ + Roles  │    │ + route file │    │  + Guard      │
└────┬─────┘    └──────┬───────┘    └───────┬───────┘
     │                 │                    │
     └─────────────────┴────────────────────┘
                       │
              better-auth ac 实例
          (运行时统一校验 hasPermission)
```

所有权限检查最终都由 `better-auth` 的 `ac`（Access Control）实例执行，前后端共享同一份声明。

---

## Step 1：声明权限资源

文件：`libs/auth/src/permissions.ts`

### 1.1 添加资源常量

```typescript
const Resource = {
  // ... 现有资源
  WAREHOUSE: 'warehouse' // 新增
} as const
```

### 1.2 声明资源可用操作

决定该资源支持哪些操作。大多数资源使用 `BaseActions`（`create` / `view` / `edit` / `delete`）：

```typescript
const statements = {
  ...defaultStatements,
  // ... 现有声明
  [Resource.WAREHOUSE]: BaseActions // CRUD 四项操作
} as const
```

如果模块需要自定义操作（如 `export` / `approve`），可以定义新的 Actions 数组：

```typescript
const WarehouseActions = [...BaseActions, 'export', 'approve'] as const

const statements = {
  // ...
  [Resource.WAREHOUSE]: WarehouseActions
} as const
```

### 1.3 如果新模块需要作为「工作区级功能开关」

当你想通过权限来控制整个模块的入口可见性（类似 CRM 模块入口），需要在 `WorkspaceActions` 中添加：

```typescript
const WorkspaceActions = ['crm', 'organization', 'warehouse'] as const
```

然后前端就可以通过 `hasPermission({ workspace: ['warehouse'] })` 来控制一级菜单的显示/隐藏。

> 大多数二级菜单/页面只需要检查具体资源权限（如 `{ warehouse: ['view'] }`），不需要新增 WorkspaceActions。

---

## Step 2：为预定义角色分配权限

同一文件：`libs/auth/src/permissions.ts`

系统有三个预定义角色，根据业务需求分配新资源的权限：

```typescript
const owner = ac.newRole({
  // ... 现有权限
  [Resource.WAREHOUSE]: ['create', 'view', 'edit', 'delete']
})

const admin = ac.newRole({
  // ... 现有权限
  [Resource.WAREHOUSE]: ['create', 'view', 'edit']
})

const member = ac.newRole({
  // ... 现有权限
  [Resource.WAREHOUSE]: ['view']
})
```

### 权限分配原则

| 角色 | 定位 | 建议 |
|------|------|------|
| `owner` | 组织所有者 | 给所有操作 |
| `admin` | 组织管理员 | 给除 `delete` 外的大部分操作 |
| `member` | 普通成员 | 仅 `view`，或空数组 `[]` 表示无权限 |

> 业务角色（如"仓库主管"）不在 `permissions.ts` 中硬编码，而是由组织 owner/admin 在运行时通过动态角色管理创建。详见 [Step 7](#step-7动态角色管理)。

---

## Step 3：数据库变更

如果新模块需要新建数据表：

### 3.1 编写 Prisma Schema

在 `libs/pg-dao/src/models/` 中添加或修改 `.prisma` 文件：

```prisma
model Warehouse {
  id             String       @id
  name           String
  organizationId String       @map("organization_id")
  organization   Organization @relation(fields: [organizationId], references: [id])
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")

  @@index([organizationId])
  @@map("warehouse")
  @@schema("public")
}
```

不要忘记在 `Organization` 模型中添加反向关系：

```prisma
model Organization {
  // ... 现有字段
  warehouses Warehouse[]
}
```

### 3.2 生成 Migration

```bash
pnpm db:migrate add_warehouse_table
```

### 3.3 重新生成 Prisma Client

```bash
pnpm db:generate
```

> `db:generate` 只会基于受版本控制的 Prisma schema 生成 Client，不会覆盖
> `auth.prisma`。Better Auth schema 在治理流程落地前保持冻结；禁止使用临时下载的
> `@latest` CLI 更新物理数据库契约。

### 3.4 如果仅修改 permissions.ts（无数据表变更）

不需要创建 migration。权限声明是纯 TypeScript 代码，编译后直接生效。

---

## Step 4：注册前端路由

### 4.1 添加路由路径

文件：`libs/studio/src/config/paths.ts`

```typescript
const WAREHOUSE_PREFIX = '/warehouse'

const pathsConfig = {
  // ... 现有路径
  warehouse: {
    index: WAREHOUSE_PREFIX,
    inventory: `${WAREHOUSE_PREFIX}/inventory`,
    transfers: `${WAREHOUSE_PREFIX}/transfers`
  }
} as const
```

### 4.2 创建路由文件

遵循 TanStack Router 文件路由约定，在 `apps/web/src/routes/_app/` 下创建：

**布局文件** `_app/warehouse.tsx`：

```tsx
import { useMemo } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { getWarehouseNavConfig, SecondaryNavProvider } from '@libs/studio'

export const Route = createFileRoute('/_app/warehouse')({
  component: WarehouseLayout
})

function WarehouseLayout() {
  const { t } = useTranslation(['common', 'warehouse'])
  const navConfig = useMemo(
    () => getWarehouseNavConfig(t as Parameters<typeof getWarehouseNavConfig>[0]),
    [t]
  )

  return (
    <SecondaryNavProvider config={navConfig}>
      <Outlet />
    </SecondaryNavProvider>
  )
}
```

**首页** `_app/warehouse/index.tsx`：

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/warehouse/')({
  component: WarehouseDashboard
})

function WarehouseDashboard() {
  return <div>Warehouse Dashboard</div>
}
```

**子页面** `_app/warehouse/inventory/index.tsx`：

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/warehouse/inventory/')({
  component: InventoryPage
})

function InventoryPage() {
  return <div>Inventory</div>
}
```

---

## Step 5：配置前端菜单与鉴权

### 5.1 创建导航配置

文件：`libs/studio/src/modules/warehouse/nav-config.tsx`

```tsx
import type { SecondaryNavConfig } from '../../common/components/layout/app-shell/nav-config'
import type { TFunction } from 'i18next'

import { Icons } from '@libs/ui-web'
import { pathsConfig } from '../../config/paths'

export function getWarehouseNavConfig(
  t: TFunction<['common', 'warehouse']>
): SecondaryNavConfig {
  return {
    title: t('warehouse:title'),
    groups: [
      {
        items: [
          {
            label: t('warehouse:pages.inventory'),
            href: pathsConfig.warehouse.inventory,
            icon: <Icons.Package />
          },
          {
            label: t('warehouse:pages.transfers'),
            href: pathsConfig.warehouse.transfers,
            icon: <Icons.ArrowLeftRight />
          }
        ]
      }
    ]
  }
}
```

记得在 `libs/studio/src/index.ts` 中导出该函数。

### 5.2 一级菜单权限控制

文件：`apps/web/src/routes/_app.tsx`

在 `beforeLoad` 中检查用户是否有权限进入该模块：

```typescript
beforeLoad: async () => {
  // ... 现有 session 检查

  // 检查工作区级权限（如果在 Step 1 中添加了 WorkspaceAction）
  const canAccessWarehouse = await hasOrgPermission({
    workspace: ['warehouse']
  })

  // 或者直接检查资源权限
  const canAccessWarehouse = await hasOrgPermission({
    warehouse: ['view']
  })

  return {
    // ... 现有 context
    access: {
      crm: canAccessCrm,
      warehouse: canAccessWarehouse  // 新增
    }
  }
}
```

在 `AppLayout` 组件的 `menu` 数组中添加条件渲染：

```tsx
const menu: AppShellMenuItem[] = [
  // ... 现有菜单
  ...(access.warehouse
    ? [{
        label: 'warehouse',
        href: pathsConfig.warehouse.index,
        icon: <Icons.Warehouse className="size-6" />,
        defaultSubRoute: getDefaultSubRoute(warehouseNavConfig),
        subItems: flattenNavConfig(warehouseNavConfig)
      }]
    : [])
]
```

### 5.3 子路由权限守卫

如果子页面需要更细粒度的权限控制，在路由的 `beforeLoad` 中检查：

```typescript
// _app/warehouse/inventory/index.tsx
export const Route = createFileRoute('/_app/warehouse/inventory/')({
  beforeLoad: async () => {
    const hasAccess = await hasOrgPermission({
      warehouse: ['view']
    })
    if (!hasAccess) {
      throw redirect({ to: pathsConfig.user.profile })
    }
  },
  component: InventoryPage
})
```

> `hasOrgPermission` 定义在 `_app.tsx` 中，子路由可通过 `import` 或 route context 使用。

### 5.4 添加 i18n 翻译

创建 `libs/i18n/src/translations/zh/warehouse.json` 和 `en/warehouse.json`：

```json
{
  "title": "仓库管理",
  "pages": {
    "inventory": "库存",
    "transfers": "调拨"
  }
}
```

在 i18n 配置中注册新的 namespace。

---

## Step 6：后端接口鉴权

### 6.1 基本权限检查

在 NestJS Controller 中使用 `@RequirePermissions` 装饰器：

```typescript
import { RequirePermissions } from '@libs/srv-shared'

@Controller('warehouses')
export class WarehouseController {
  @RequirePermissions({ warehouse: ['view'] })
  @Get()
  list() {
    // 只有拥有 warehouse:view 权限的用户才能访问
  }

  @RequirePermissions({ warehouse: ['create'] })
  @Post()
  create(@Body() dto: CreateWarehouseDto) {
    // 只有拥有 warehouse:create 权限的用户才能创建
  }

  @RequirePermissions({ warehouse: ['edit'] })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWarehouseDto) {}

  @RequirePermissions({ warehouse: ['delete'] })
  @Delete(':id')
  delete(@Param('id') id: string) {}
}
```

### 6.2 组织上下文校验

当接口路径中包含组织 ID 时，使用 `@OrgIdSource` 防止跨组织访问：

```typescript
@Controller('organizations/:orgId/warehouses')
export class OrgWarehouseController {
  @OrgIdSource({ param: 'orgId' })
  @RequirePermissions({ warehouse: ['create'] })
  @Post()
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateWarehouseDto
  ) {
    // AuthGuard 会验证 orgId 与 session.activeOrganizationId 一致
  }
}
```

`@OrgIdSource` 支持从四种位置提取组织 ID：

| 参数 | 来源 | 示例 |
|------|------|------|
| `param` | URL 路由参数 | `@OrgIdSource({ param: 'orgId' })` |
| `body` | 请求体字段 | `@OrgIdSource({ body: 'organizationId' })` |
| `header` | 请求头 | `@OrgIdSource({ header: 'x-organization-id' })` |
| `query` | 查询参数 | `@OrgIdSource({ query: 'orgId' })` |

### 6.3 角色检查

如果只需要检查角色（不需要细粒度权限），使用 `@Roles`：

```typescript
@Roles(['owner', 'admin'])
@Delete(':id')
delete(@Param('id') id: string) {
  // 只有 owner 和 admin 角色的成员可以删除
}
```

### 6.4 获取当前上下文

```typescript
@RequirePermissions({ warehouse: ['view'] })
@Get()
list(
  @CurrentUser() user: User,
  @CurrentOrgId() orgId: string
) {
  // user: 当前用户
  // orgId: 当前活跃组织 ID（与权限检查一致）
  return this.warehouseService.findByOrg(orgId)
}
```

### 6.5 公开接口

无需鉴权的接口使用 `@AllowAnonymous()`：

```typescript
@AllowAnonymous()
@Get('public/warehouses')
listPublic() {}
```

---

## Step 7：动态角色管理

预定义角色（`owner`/`admin`/`member`）仅提供基础权限。业务角色由组织 owner/admin 在运行时创建。

### 客户端创建自定义角色

```typescript
await authClient.organization.createRole({
  name: 'warehouse-manager',
  permissions: {
    warehouse: ['create', 'view', 'edit', 'delete'],
    inventory: ['create', 'view', 'edit']
  }
})
```

### 分配角色

```typescript
await authClient.organization.updateMemberRole({
  memberId: 'member-id',
  role: 'warehouse-manager'
})
```

### 管理端 UI

组织设置页面应提供角色管理界面，让 owner/admin 能够：

1. 查看所有角色及其权限
2. 创建/编辑/删除自定义角色
3. 为成员分配角色

---

## Step 8：重启与部署注意事项

| 变更类型 | 需要重启 engine？ | 需要重新构建 web？ | 需要 migration？ |
|----------|-------------------|--------------------|--------------------|
| 修改 `permissions.ts` | **是** | **是** | 否 |
| 新增 Prisma model | **是** | 否（除非前端使用类型） | **是**（`pnpm db:migrate`） |
| 新增前端路由文件 | 否 | **是**（dev 模式自动热更新） | 否 |
| 修改 nav-config | 否 | **是**（dev 模式自动热更新） | 否 |
| 修改 i18n JSON | 否 | **是**（dev 模式自动热更新） | 否 |
| 修改 NestJS Controller 装饰器 | **是** | 否 | 否 |
| 动态创建/修改角色（API 调用） | 否 | 否 | 否 |

### 关键点

- **`permissions.ts` 是前后端共享的**：修改后前后端都需要重新构建/重启。
- **动态角色无需重启**：通过 `authClient.organization.createRole` 创建的角色存储在数据库中，`hasPermission` API 会实时查询。
- **Session 缓存**：`server.ts` 中配置了 `cookieCache.maxAge: 5 * 60`（5 分钟），权限变更后用户最多需等待 5 分钟生效，或重新登录。
- **开发环境**：`pnpm dev:web` 和 `pnpm dev:engine` 会自动热更新代码变更。

---

## Checklist

新增模块时，按以下清单逐项确认：

- [ ] **权限声明**
  - [ ] `permissions.ts` 中添加 `Resource` 常量
  - [ ] `statements` 中声明该资源的操作列表
  - [ ] 为 `owner`、`admin`、`member` 三个角色分配权限
  - [ ] （可选）`WorkspaceActions` 中添加模块级开关

- [ ] **数据库**
  - [ ] 新建 Prisma model（如需要）
  - [ ] `pnpm db:migrate <name>` 生成并应用 migration
  - [ ] `pnpm db:generate` 重新生成 Prisma Client

- [ ] **前端路由**
  - [ ] `libs/studio/src/config/paths.ts` 添加路由路径
  - [ ] `apps/web/src/routes/_app/` 创建布局和页面文件
  - [ ] 布局文件引入 `SecondaryNavProvider`

- [ ] **前端菜单与鉴权**
  - [ ] `libs/studio/src/modules/<module>/nav-config.tsx` 创建导航配置
  - [ ] `_app.tsx` 的 `beforeLoad` 中添加权限检查
  - [ ] `_app.tsx` 的 `menu` 数组中添加条件渲染
  - [ ] 子路由 `beforeLoad` 中添加细粒度权限守卫（按需）
  - [ ] `libs/studio/src/index.ts` 导出新的导航配置函数

- [ ] **后端接口**
  - [ ] Controller 方法添加 `@RequirePermissions({ resource: ['action'] })`
  - [ ] 组织相关接口添加 `@OrgIdSource`
  - [ ] 使用 `@CurrentOrgId()` 获取组织上下文

- [ ] **国际化**
  - [ ] `libs/i18n/src/translations/zh/<module>.json` 添加中文翻译
  - [ ] `libs/i18n/src/translations/en/<module>.json` 添加英文翻译
  - [ ] i18n 配置中注册新 namespace

- [ ] **测试验证**
  - [ ] owner 角色能看到并操作所有功能
  - [ ] admin 角色权限符合预期
  - [ ] member 角色只能看到受限内容
  - [ ] 未授权用户看不到菜单入口
  - [ ] 后端接口对未授权请求返回 403

---

## 附录：文件路径速查

| 用途 | 路径 |
|------|------|
| 权限声明 | `libs/auth/src/permissions.ts` |
| Auth 服务端配置 | `libs/auth/src/server.ts` |
| Auth 类型导出 | `libs/auth/src/types.ts` |
| 路由路径配置 | `libs/studio/src/config/paths.ts` |
| 导航配置目录 | `libs/studio/src/modules/<module>/nav-config.tsx` |
| 前端路由目录 | `apps/web/src/routes/_app/` |
| 前端根布局 | `apps/web/src/routes/_app.tsx` |
| 后端装饰器 | `libs/srv-shared/src/auth/auth.decorator.ts` |
| 后端 Guard | `libs/srv-shared/src/auth/auth.guard.ts` |
| i18n 翻译 | `libs/i18n/src/translations/{zh,en}/` |
| Prisma Schema | `libs/pg-dao/src/models/` |
| Prisma Migrations | `libs/pg-dao/src/migrations/` |
