import type { Member, User } from '@libs/auth-web'
import type { AppShellMenuItem } from '@libs/studio'

import { useEffect, useMemo, useRef } from 'react'
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'

import { ApiClientProvider } from '@libs/api-client'
import { hasAdminPermission, hasOrgAdminPermission, MemberRole } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import {
  AppShell,
  authClient,
  flattenNavConfig,
  getAdminNavConfig,
  getCrmNavConfig,
  getDefaultSubRoute,
  ImpersonatingBanner,
  pathsConfig
} from '@libs/studio'
import { Icons } from '@libs/ui-shared/web'

// 应用内页共享布局 - pathless route (不添加到 URL)
// 采用 SPA 模式，需要认证
export const Route = createFileRoute('/_app')({
  ssr: false,
  beforeLoad: async () => {
    // 客户端认证检查
    // authClient.getSession() 运行时返回: null | { session, user }
    // TypeScript 类型与运行时不一致，需要类型断言
    const session = (await authClient.getSession()) as unknown as { session: unknown; user: User | null } | null
    if (!session?.user) {
      throw redirect({
        to: pathsConfig.auth.login,
        search: { redirectTo: undefined, invitationId: undefined, email: undefined }
      })
    }

    // 获取用户所属的组织列表
    // authClient 配置了 throw: true，API 直接返回数据而非 { data, error } 包装
    const organizations = (await authClient.organization.list({})) as unknown as Array<{
      id: string
      name: string
      slug: string
    }> | null

    // 获取当前活跃组织中的成员信息（包含角色）
    // 在 beforeLoad 中同步获取，避免组件挂载后 hook 异步加载导致菜单闪烁
    let activeMember: Member | null = null
    try {
      const memberResult = (await authClient.organization.getActiveMember()) as unknown as
        | (Member & { role: string })
        | null
      if (memberResult?.role) {
        activeMember = memberResult
      }
    } catch {
      activeMember = null
    }

    return {
      user: session.user,
      organizations: organizations ?? [],
      activeMember
    }
  },
  component: AppLayout
})

function AppLayout() {
  const navigate = useNavigate()
  const { t } = useTranslation(['common', 'dashboard'])
  // beforeLoad 返回的静态数据，确保首次渲染时可用
  const { user, activeMember: contextActiveMember } = Route.useRouteContext()
  // 响应式 session，当用户信息变化时自动更新
  const { data: session } = authClient.useSession()
  // beforeLoad 每次导航都会重新获取 activeMember，是最可靠的数据源
  // 避免使用 useActiveMember() hook，因为 hook 内部缓存在跨页面导航时可能包含陈旧数据
  const activeMember = contextActiveMember

  // 优先使用实时 session 数据，回退到 beforeLoad 的初始数据
  const currentUser = (session?.user ?? user) as User
  // 全局管理员权限（user.role）
  const isAdmin = hasAdminPermission(currentUser)
  // 当前活跃组织的管理权限（member.role 为 admin 或 owner）
  const isOrgAdminOrOwner = hasOrgAdminPermission(activeMember?.role as MemberRole)

  // 获取各模块的导航配置（单一数据源）
  const crmNavConfig = useMemo(() => getCrmNavConfig(t as Parameters<typeof getCrmNavConfig>[0]), [t])
  const adminNavConfig = useMemo(() => getAdminNavConfig(t as Parameters<typeof getAdminNavConfig>[0]), [t])

  // 根据用户权限构建一级菜单
  // subItems 从各模块的 navConfig 自动生成，确保数据源唯一
  const menu: AppShellMenuItem[] = [
    ...(isOrgAdminOrOwner
      ? [
          {
            label: 'home',
            href: pathsConfig.crm.index,
            icon: <Icons.Home className="size-6" />,
            // 默认子路由：从配置中获取
            defaultSubRoute: getDefaultSubRoute(crmNavConfig),
            // subItems：从配置中扁平化获取
            subItems: flattenNavConfig(crmNavConfig)
          }
        ]
      : []),
    // 管理员菜单
    ...(isAdmin
      ? [
          {
            label: 'admin',
            href: pathsConfig.admin.index,
            icon: <Icons.Shield className="size-6" />,
            // 默认子路由：从配置中获取
            defaultSubRoute: getDefaultSubRoute(adminNavConfig),
            // subItems：从配置中扁平化获取
            subItems: flattenNavConfig(adminNavConfig)
          }
        ]
      : [])
  ]

  // 跟踪 session 是否曾经有效，避免初始 null（hook 未解析）触发误跳转
  // beforeLoad 已确保首次加载时 session 有效，此 effect 仅处理运行时 session 失效（如 token 过期）
  const hadSession = useRef(false)
  useEffect(() => {
    if (session !== null) {
      hadSession.current = true
    }
    if (hadSession.current && session === null) {
      navigate({
        to: pathsConfig.auth.login,
        search: { redirectTo: undefined, invitationId: undefined, email: undefined }
      })
    }
  }, [navigate, session])

  return (
    <ApiClientProvider options={{ baseURL: '/api/v1' }}>
      <AppShell user={currentUser} menu={menu}>
        <ImpersonatingBanner />
        <Outlet />
      </AppShell>
    </ApiClientProvider>
  )
}
