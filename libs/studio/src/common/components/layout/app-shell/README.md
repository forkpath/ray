# AppShell 组件

应用主布局框架组件，提供统一的导航结构和响应式设计支持。

## 目录结构

```
app-shell/
├── index.tsx                 # AppShell 主组件
├── app-header.tsx            # 顶部导航栏组件
├── navigation-store.ts       # 导航状态管理 (Zustand)
├── secondary-nav-store.ts    # 二级导航状态管理 (Zustand)
├── secondary-nav-context.tsx # 二级导航 Provider 和 Hook
├── user-secondary-nav.tsx    # 用户二级导航组件
└── README.md                 # 本文档
```

## 核心概念

### 布局结构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AppHeader                                     │
│  [Sidebar Toggle] [Search]              [Language] [Activity] [Bell] │
├──────────┬──────────────────┬───────────────────────────────────────┤
│          │                  │                                        │
│  一级    │     二级导航     │              主内容区                   │
│  导航    │                  │                                        │
│          │  (动态内容区域)   │                                        │
│  ┌────┐  │                  │                                        │
│  │ 🏠 │  │  根据当前路由    │                                        │
│  │ 📊 │  │  显示不同内容:   │                                        │
│  │ ⚙️ │  │                  │                                        │
│  │ ... │  │  - CRM 导航      │                                        │
│  └────┘  │  - Admin 导航    │                                        │
│          │  - 用户设置导航  │                                        │
│  ┌────┐  │                  │                                        │
│  │ 👤 │  │                  │                                        │
│  │User│  │                  │                                        │
│  └────┘  │                  │                                        │
└──────────┴──────────────────┴───────────────────────────────────────┘
```

### 导航层级

1. **一级导航 (Sidebar)**
   - 位于左侧，始终可见
<<<<<<< HEAD
   - 包含主要功能模块入口（如Admin）
=======
   - 包含主要功能模块入口（如 CRM、Admin）
>>>>>>> 01f70ac (Initial commit)
   - 底部显示用户头像
   - 支持折叠/展开

2. **二级导航**
   - 位于一级导航右侧
   - 内容由当前路由/模块动态决定
   - 可以是复杂的仪表板式导航（如 CRM）
   - 或简单的菜单列表（如用户设置）

3. **用户导航**
   - 点击 Sidebar 底部的用户头像触发
   - 显示用户相关的设置和操作
   - 包含工作空间切换功能

## 使用方式

### 基础使用

```tsx
import { AppShell } from '@libs/studio'

function App() {
  const menu = [
    {
      icon: <HomeIcon />,
      label: 'crm',
      href: '/crm',
      defaultSubRoute: '/crm/dashboard' // 首次点击时的默认路由
    },
    {
      icon: <AdminIcon />,
      label: 'admin',
      href: '/admin',
      defaultSubRoute: '/admin/users' // 首次点击时的默认路由
    }
  ]

  return (
    <AppShell user={currentUser} menu={menu}>
      <Outlet />
    </AppShell>
  )
}
```

### 配置二级导航

**推荐方式：配置式（数据源唯一）**

```tsx
<<<<<<< HEAD
import { getCrmNavConfig, SecondaryNavProvider } from '@libs/studio'
=======
import { SecondaryNavProvider, getCrmNavConfig } from '@libs/studio'
>>>>>>> 01f70ac (Initial commit)

function CrmLayout() {
  const { t } = useTranslation(['common', 'dashboard'])

  // 使用统一的导航配置函数
<<<<<<< HEAD
  const navConfig = useMemo(() => getCrmNavConfig(t), [t])
=======
  const navConfig = useMemo(
    () => getCrmNavConfig(t),
    [t]
  )
>>>>>>> 01f70ac (Initial commit)

  return (
    // 配置式：自动生成 desktopContent 和 mobileItems
    <SecondaryNavProvider config={navConfig} quickAccessTitle={t('dashboard:pages.title')}>
      <Outlet />
    </SecondaryNavProvider>
  )
}
```

**自定义方式（需要完全自定义 UI 时使用）**

```tsx
import { SecondaryNavProvider } from '@libs/studio'

function CustomLayout() {
  return (
    <SecondaryNavProvider
      value={{
        desktopContent: <CustomSecondaryNav />,
        mobileItems: customItems,
        title: 'Custom'
      }}
    >
      <Outlet />
    </SecondaryNavProvider>
  )
}
```

## 导航配置架构

### 单一数据源原则

每个模块的导航数据只定义一次，通过配置函数导出：

```
libs/studio/src/modules/
├── crm/
│   └── nav-config.ts      # getCrmNavConfig(t)
├── admin/
│   └── nav-config.ts      # getAdminNavConfig(t)
└── ...
```

### 配置类型

```typescript
interface SecondaryNavConfig {
<<<<<<< HEAD
  title?: string // 导航标题
  stats?: NavStatCard[] // 统计卡片
  progress?: NavProgress // 进度指示器
  quickAccess?: NavItem[] // 快捷入口（网格）
  groups: NavGroup[] // 导航分组
}

interface NavItem {
  label: string // 显示标签
  href: string // 跳转路径
  icon: ReactNode // 图标
=======
  title?: string           // 导航标题
  stats?: NavStatCard[]    // 统计卡片
  progress?: NavProgress   // 进度指示器
  quickAccess?: NavItem[]  // 快捷入口（网格）
  groups: NavGroup[]       // 导航分组
}

interface NavItem {
  label: string    // 显示标签
  href: string     // 跳转路径
  icon: ReactNode  // 图标
>>>>>>> 01f70ac (Initial commit)
}
```

### 自动转换

配置会自动转换为：
<<<<<<< HEAD

=======
>>>>>>> 01f70ac (Initial commit)
- **大屏展开**：`SecondaryNavRenderer` 渲染完整 UI
- **大屏折叠/小屏**：`flattenNavConfig()` 生成扁平列表

```tsx
// _app.tsx 中的使用示例
const crmNavConfig = getCrmNavConfig(t)

const menu = [
  {
    label: 'home',
    href: '/crm',
    icon: <HomeIcon />,
    defaultSubRoute: getDefaultSubRoute(crmNavConfig),
<<<<<<< HEAD
    subItems: flattenNavConfig(crmNavConfig) // 自动扁平化
=======
    subItems: flattenNavConfig(crmNavConfig)  // 自动扁平化
>>>>>>> 01f70ac (Initial commit)
  }
]
```

## 状态管理

### navigation-store.ts

管理导航状态，使用 `persist` 中间件持久化到 localStorage。

```tsx
import { useNavigationStore } from '@libs/studio/components/layout/app-shell/navigation-store'

// 获取/设置用户导航展开状态
const userNavExpanded = useNavigationStore(state => state.userNavExpanded)
const setUserNavExpanded = useNavigationStore(state => state.setUserNavExpanded)

// 记录/获取模块最后访问的子路由
const setLastVisitedRoute = useNavigationStore(state => state.setLastVisitedRoute)
const getLastVisitedRoute = useNavigationStore(state => state.getLastVisitedRoute)

// 示例：记录 admin 模块的最后访问路由
setLastVisitedRoute('/admin', '/admin/users')

// 示例：获取 admin 模块的最后访问路由，默认返回 /admin/users
const lastRoute = getLastVisitedRoute('/admin', '/admin/users')

// 重置导航状态（用于切换身份时）
const resetNavigation = useNavigationStore(state => state.resetNavigation)
resetNavigation() // 清除所有导航状态
```

### 身份切换

当用户切换身份（个人空间/组织）时，需要重置导航状态：

```tsx
import { useNavigationStore } from '@libs/studio/common/components/layout/app-shell/navigation-store'

function handleSwitchIdentity() {
  const resetNavigation = useNavigationStore.getState().resetNavigation
<<<<<<< HEAD

  // 切换身份
  await authClient.organization.setActive({ organizationId: orgId })

  // 重置导航状态
  resetNavigation()

=======
  
  // 切换身份
  await authClient.organization.setActive({ organizationId: orgId })
  
  // 重置导航状态
  resetNavigation()
  
>>>>>>> 01f70ac (Initial commit)
  // 导航到默认页面
  navigate({ to: '/crm' })
}
```

### secondary-nav-store.ts

管理二级导航的内容状态，由 `SecondaryNavProvider` 自动管理。

```tsx
import { useSecondaryNav } from '@libs/studio'

// 获取当前二级导航状态
const { desktopContent, mobileItems, title } = useSecondaryNav()
```

## 响应式设计

### 大屏模式 (md+)

- 一级导航完整显示
- 二级导航在右侧独立显示
- 可通过 Header 按钮折叠二级导航

### 小屏模式 (<md)

- 一级导航可折叠为图标模式
- 二级导航以下拉菜单形式显示
- 用户导航以可折叠列表形式显示

### Sidebar 折叠模式

当 Sidebar 折叠时（仅显示图标）：

- 鼠标悬停在菜单项上显示下拉菜单
- 下拉菜单包含对应的二级导航项
- **点击一级导航不会切换路由**，仅显示下拉菜单

## 导航行为

### 二级导航展开时

1. **点击一级导航**：跳转到该模块**最后访问的子路由**
   - 如果从未访问过该模块的子路由，则跳转到 `defaultSubRoute`
   - 如果没有配置 `defaultSubRoute`，则跳转到 `href`

2. **路由记录**：自动记录每个模块访问的子路由
   - 仅记录子路由，不记录模块根路由
   - 记录持久化到 localStorage，刷新后保留

### 二级导航折叠时

- **点击一级导航不会切换路由**
- 仅作为视觉反馈，需要先展开二级导航

### 示例

```tsx
const menu = [
  {
    icon: <AdminIcon />,
    label: 'admin',
    href: '/admin',
    defaultSubRoute: '/admin/users' // 首次点击跳转到 /admin/users
  },
  {
    icon: <CrmIcon />,
    label: 'crm',
    href: '/crm',
    defaultSubRoute: '/crm/dashboard'
  }
]
```

用户行为流程：

1. 首次点击 Admin → 跳转到 `/admin/users`（defaultSubRoute）
2. 访问 `/admin/organizations` → 记录到 store
3. 切换到 CRM 模块
4. 再次点击 Admin → 跳转到 `/admin/organizations`（最后访问的路由）

## 组件 API

### AppShell

| 属性          | 类型               | 说明                  |
| ------------- | ------------------ | --------------------- |
| user          | User               | 当前登录用户信息      |
| menu          | AppShellMenuItem[] | 一级导航菜单配置      |
| children      | ReactNode          | 页面主内容            |
| headerActions | ReactNode          | Header 右侧自定义操作 |
| logo          | ReactNode          | 自定义 Logo           |

### AppShellMenuItem

| 属性            | 类型      | 说明                                     |
| --------------- | --------- | ---------------------------------------- |
| icon            | ReactNode | 菜单项图标                               |
| label           | string    | 菜单项标签（支持 i18n key）              |
| href            | string    | 路由路径前缀（用于高亮判断和路由记录）   |
| defaultSubRoute | string    | 可选，默认子路由（首次点击时跳转的路径） |

### SecondaryNavConfig

| 属性           | 类型               | 说明                   |
| -------------- | ------------------ | ---------------------- |
| desktopContent | ReactNode          | 大屏模式显示的导航内容 |
| mobileItems    | SecondaryNavItem[] | 小屏模式的菜单项       |
| title          | string             | 导航标题               |

## 路由激活状态

导航的激活状态通过路由路径匹配自动判断：

```tsx
// 一级导航激活判断
const isMenuActive = (menuHref: string) => {
  return pathname === menuHref || pathname.startsWith(menuHref + '/')
}

// 用户导航激活判断
const USER_NAV_PATHS = ['/user', '/organization']
const isUserNavActive = () => {
  return USER_NAV_PATHS.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))
}
```

这确保了：

- 页面刷新后导航状态正确恢复
- 不需要手动管理激活状态
- URL 是唯一的状态来源

## 最佳实践

1. **二级导航内容分离**
   - 将二级导航组件定义在对应模块中
   - 通过 SecondaryNavProvider 动态设置

2. **移动端菜单项**
   - 始终提供 mobileItems，确保移动端可用
   - 菜单项数量建议控制在 5-7 个

3. **路由配置**
   - 一级导航的 href 应该是路由前缀
   - 确保子路由路径以父路由前缀开头

4. **性能优化**
   - 使用 memo 包裹导航组件
   - 避免在导航组件中进行复杂计算
