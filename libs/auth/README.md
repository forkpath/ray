# @libs/auth

基于 [Better Auth](https://www.better-auth.com/) 构建的认证与授权模块，支持多种登录方式、组织管理和动态角色权限控制。

## 目录

- [功能特性](#功能特性)
- [架构概览](#架构概览)
- [权限系统](#权限系统)
- [前端使用](#前端使用)
- [后端使用](#后端使用)
- [动态角色管理](#动态角色管理)
- [API 参考](#api-参考)

## 功能特性

- ✅ 多种认证方式：密码、Magic Link、Passkey、OAuth（Google/GitHub）
- ✅ 组织管理：创建组织、邀请成员、角色分配
- ✅ 动态访问控制：运行时创建/修改角色和权限（dynamicAccessControl）
- ✅ 基于资源的权限模型：CRUD + 工作区能力（`crm` / `organization`）
- ✅ 前后端统一的权限检查 API

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端 (Web/Mobile)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ createClient│  │hasPermission│  │checkRolePermission(同步)│  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Better Auth Server                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  auth.api   │  │ organization│  │  dynamicAccessControl   │  │
│  │ .getSession │  │ .hasPermis- │  │  (运行时角色管理)        │  │
│  │             │  │  sion       │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NestJS 后端服务                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  AuthGuard  │  │@RequirePer- │  │    @OrgIdSource         │  │
│  │             │  │  missions   │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 权限系统

### 资源与操作

权限基于 **资源 (Resource)** 和 **操作 (Action)** 的组合：

```typescript
// libs/auth/src/permissions.ts

// 基础操作
const BaseActions = ['create', 'view', 'edit', 'delete'] as const
const WorkspaceActions = ['crm', 'organization'] as const

// 资源类型
const Resource = {
  PRODUCT: 'product', // 产品管理
  ORDER: 'order', // 订单管理
  CUSTOMER: 'customer', // 客户管理
  INVENTORY: 'inventory', // 库存管理
  REPORT: 'report', // 报表管理
  SETTINGS: 'settings', // 系统设置
  WORKSPACE: 'workspace' // 工作区能力开关（菜单/模块入口）
} as const
```

### 预定义角色

| 角色        | 说明       | 权限范围                       |
| ----------- | ---------- | ------------------------------ |
| `owner`     | 所有者     | 所有资源的全部操作             |
| `admin`     | 管理员     | 大部分资源的全部操作，部分限制 |
| `member`    | 普通成员   | 基础查看权限                   |
| `动态角色`  | 业务角色   | 由组织 owner/admin 运行时管理  |

### 添加新资源

在 `libs/auth/src/permissions.ts` 中添加：

```typescript
// 1. 添加资源类型
const Resource = {
  // ... 现有资源
  SUPPLIER: 'supplier' // 新增：供应商管理
} as const

// 2. 在 statements 中声明
const statements = {
  // ... 现有声明
  [Resource.SUPPLIER]: BaseActions
} as const

// 3. 为各角色分配权限
const admin = ac.newRole({
  // ... 现有权限
  [Resource.SUPPLIER]: ['create', 'view', 'edit', 'delete']
})
```

## 前端使用

### 初始化客户端

**Web 端：**

```typescript
import { createClient } from '@libs/auth-web'

const authClient = createClient({
  baseURL: '/api/auth'
})
```

**Mobile 端：**

```typescript
import { createClient } from '@libs/auth-native'

const mobileAuthClient = createClient({
  baseURL: 'https://api.example.com/api/auth',
  mobile: {
    /* expo 配置 */
  },
  lastLoginMethod: {
    /* 配置 */
  }
})
```

### 权限检查

#### 异步检查（推荐，支持动态角色）

```typescript
import { checkPermission } from '@libs/auth-web'

// 检查单个权限
const canCreateProduct = await checkPermission(authClient, {
  product: ['create']
})

// 检查多个权限
const canManageOrders = await checkPermission(authClient, {
  order: ['create', 'edit'],
  customer: ['view']
})

// 直接使用客户端 API
const { data } = await authClient.organization.hasPermission({
  permissions: {
    product: ['delete']
  }
})
```

#### 同步检查（仅支持预定义角色）

```typescript
import { checkRolePermission } from '@libs/auth-web'

// 检查角色是否有权限（不发起网络请求）
const canDelete = checkRolePermission(authClient, 'admin', {
  product: ['delete']
})
```

### React 组件中使用

```tsx
import { checkPermission, createClient } from '@libs/auth-web'

const authClient = createClient({ baseURL: '/api/auth' })

function ProductActions() {
  const [canEdit, setCanEdit] = useState(false)
  const [canDelete, setCanDelete] = useState(false)

  useEffect(() => {
    async function checkPermissions() {
      setCanEdit(await checkPermission(authClient, { product: ['edit'] }))
      setCanDelete(await checkPermission(authClient, { product: ['delete'] }))
    }
    checkPermissions()
  }, [])

  return (
    <div>
      {canEdit && <Button>编辑</Button>}
      {canDelete && <Button variant="danger">删除</Button>}
    </div>
  )
}
```

## 后端使用

### 装饰器

#### `@RequirePermissions` - 权限检查

```typescript
import { RequirePermissions } from '@libs/srv-shared'

@Controller('products')
export class ProductController {
  // 需要产品创建权限
  @RequirePermissions({ product: ['create'] })
  @Post()
  create(@Body() dto: CreateProductDto) {
    // ...
  }

  // 需要多个权限
  @RequirePermissions({ product: ['edit'], inventory: ['view'] })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    // ...
  }
}
```

#### `@OrgIdSource` - 指定组织 ID 来源

```typescript
import { OrgIdSource, RequirePermissions } from '@libs/srv-shared'

@Controller('organizations/:orgId/products')
export class OrgProductController {
  // 从路由参数获取组织 ID
  @OrgIdSource({ param: 'orgId' })
  @RequirePermissions({ product: ['create'] })
  @Post()
  create(@Param('orgId') orgId: string, @Body() dto: CreateProductDto) {
    // ...
  }
}

@Controller('products')
export class ProductController {
  // 从请求头获取组织 ID
  @OrgIdSource({ header: 'x-organization-id' })
  @RequirePermissions({ product: ['view'] })
  @Get()
  list() {
    // ...
  }

  // 从请求体获取组织 ID
  @OrgIdSource({ body: 'organizationId' })
  @RequirePermissions({ order: ['create'] })
  @Post('orders')
  createOrder(@Body() dto: CreateOrderDto) {
    // ...
  }
}
```

#### 其他装饰器

```typescript
import {
  AllowAnonymous, // 允许匿名访问
  CurrentOrgId, // 获取当前组织 ID
  CurrentUser, // 获取当前用户
  OptionalAuth, // 可选认证
  Roles, // 角色检查
  Session // 获取 session
} from '@libs/srv-shared'

@Controller('public')
export class PublicController {
  @AllowAnonymous()
  @Get('health')
  health() {
    return { status: 'ok' }
  }
}

@Controller('users')
export class UserController {
  @Get('me')
  getMe(@CurrentUser() user: User) {
    return user
  }

  @Get('session')
  getSession(@Session() session: UserSession) {
    return session
  }
}
```

### 服务端权限检查

```typescript
import { fromNodeHeaders } from 'better-auth/node'

import { AuthService } from '@libs/srv-shared'

@Injectable()
export class ProductService {
  constructor(private readonly authService: AuthService) {}

  async checkCanDelete(request: Request): Promise<boolean> {
    const result = await this.authService.api.hasPermission({
      headers: fromNodeHeaders(request.headers),
      body: {
        permissions: {
          product: ['delete']
        }
      }
    })
    return result?.success ?? false
  }
}
```

## 动态角色管理

Better Auth 支持在运行时创建和管理角色。

业务角色由组织 owner/admin 在运行时通过动态角色管理创建和分配。

### 创建自定义角色

```typescript
// 客户端
const { data, error } = await authClient.organization.createRole({
  name: 'custom-manager',
  permissions: {
    product: ['create', 'view', 'edit'],
    order: ['view'],
    customer: ['view', 'edit']
  }
})

// 服务端
await auth.api.createRole({
  headers: fromNodeHeaders(request.headers),
  body: {
    name: 'custom-manager',
    permissions: {
      product: ['create', 'view', 'edit'],
      order: ['view'],
      customer: ['view', 'edit']
    }
  }
})
```

### 更新角色权限

```typescript
await authClient.organization.updateRole({
  roleId: 'role-id',
  permissions: {
    product: ['create', 'view', 'edit', 'delete'] // 添加删除权限
  }
})
```

### 分配角色给成员

```typescript
await authClient.organization.updateMemberRole({
  memberId: 'member-id',
  role: 'custom-manager'
})
```

### 列出组织角色

```typescript
const { data: roles } = await authClient.organization.listRoles()
```

## API 参考

### 权限相关类型

```typescript
// 资源操作类型
type ResourceAction =
  | 'create'
  | 'view'
  | 'edit'
  | 'delete'
  | 'crm'
  | 'organization'

// 权限检查参数
type PermissionCheckParams = {
  [resource: string]: ResourceAction[]
}

// 角色名称
type RoleName = 'owner' | 'admin' | 'member'
```

### 客户端 API

| 方法                                            | 说明                         |
| ----------------------------------------------- | ---------------------------- |
| `authClient.organization.hasPermission()`       | 异步检查权限（支持动态角色） |
| `authClient.organization.checkRolePermission()` | 同步检查权限（仅预定义角色） |
| `authClient.organization.createRole()`          | 创建自定义角色               |
| `authClient.organization.updateRole()`          | 更新角色权限                 |
| `authClient.organization.deleteRole()`          | 删除自定义角色               |
| `authClient.organization.listRoles()`           | 列出组织角色                 |

### 服务端装饰器

| 装饰器                             | 说明                 |
| ---------------------------------- | -------------------- |
| `@RequirePermissions(permissions)` | 要求指定权限         |
| `@OrgIdSource(config)`             | 指定组织 ID 来源     |
| `@AllowAnonymous()`                | 允许匿名访问         |
| `@OptionalAuth()`                  | 可选认证             |
| `@Roles(roles)`                    | 要求指定角色         |
| `@Session()`                       | 获取 session 参数    |
| `@CurrentUser()`                   | 获取当前用户参数     |
| `@CurrentOrgId()`                  | 获取当前组织 ID 参数 |

## 安全策略

### 核心原则

Better Auth 的权限检查 API (`hasPermission`, `getActiveMember`) **必须依赖 session 中的 `activeOrganizationId`**，不支持显式传入 organizationId。因此 `AuthGuard` 实现了以下安全策略：

### 组织上下文要求

1. **必须有活跃组织**：使用 `@Roles` 或 `@RequirePermissions` 时，session 必须有 `activeOrganizationId`，否则请求被拒绝
2. **Fail-Closed 策略**：如果 organization 插件未启用但使用了权限/角色装饰器，请求会被拒绝（而非默认放行）

### `@OrgIdSource` 的作用

`@OrgIdSource` 用于**验证请求的目标组织与活跃组织一致**，防止跨组织访问：

```typescript
// 假设路由参数 orgId = "org-A"，但 session.activeOrganizationId = "org-B"
// 请求会被拒绝，提示组织上下文不匹配
@OrgIdSource({ param: 'orgId' })
@RequirePermissions({ product: ['create'] })
@Post(':orgId/products')
createProduct() {}
```

验证规则：

1. 如果 `@OrgIdSource` 指定的 orgId 与 `activeOrganizationId` 不一致 → **拒绝**
2. 如果 `@OrgIdSource` 指定了 orgId 但 session 没有 `activeOrganizationId` → **拒绝**
3. 如果没有使用 `@OrgIdSource` → 仅依赖 `activeOrganizationId`

### 角色校验

`@Roles` 装饰器使用 Better Auth 的 `getActiveMember` API 检查用户在**活跃组织**中的 membership 角色：

```typescript
// 检查用户在当前活跃组织中是否为 admin 或 owner
@Roles(['admin', 'owner'])
@Put(':id')
updateProduct() {}
```

### 组织切换场景

当用户需要操作不同组织时：

1. **先切换活跃组织**：前端调用 `authClient.organization.setActive({ organizationId })`
2. **再发起请求**：后续请求的权限检查会基于新的 `activeOrganizationId`
3. **使用 `@OrgIdSource` 防止误操作**：验证请求参数中的 orgId 与活跃组织一致

```typescript
// 正确的跨组织操作流程
await authClient.organization.setActive({ organizationId: 'org-A' })
await api.createProduct({ orgId: 'org-A', ... }) // @OrgIdSource 验证通过
```

## 最佳实践

1. **优先使用 `hasPermission`**：支持动态角色，更灵活
2. **合理使用 `@OrgIdSource`**：明确指定组织上下文来源，确保与业务逻辑一致
3. **权限粒度适中**：避免过细或过粗的权限划分
4. **前端做 UI 控制，后端做真正的权限校验**：前端权限检查仅用于 UI 展示
5. **预定义角色仅保留平台基座能力**：业务角色通过动态角色管理由组织 owner/admin 分配
6. **使用 `@CurrentOrgId()` 获取组织 ID**：该装饰器会返回与权限检查一致的组织 ID
7. **组织切换后刷新权限**：前端在组织切换后应重新检查权限

## 相关文档

- [Better Auth 官方文档](https://www.better-auth.com/)
- [Organization Plugin](https://www.better-auth.com/docs/plugins/organization)
- [Access Control](https://www.better-auth.com/docs/plugins/access)
