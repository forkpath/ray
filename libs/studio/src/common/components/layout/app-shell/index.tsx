/**
 * AppShell 组件 - 应用主布局框架
 *
 * 该组件提供了应用的整体布局结构，包括：
 * - 一级导航（Sidebar）：位于左侧，包含主要功能模块入口和用户头像
 * - 二级导航：位于一级导航右侧，显示当前模块的子导航或用户设置菜单
 * - 主内容区域：显示页面主要内容
 * - 顶部 Header：包含搜索、通知、语言切换等功能
 *
 * 导航状态管理：
 * - 使用 Zustand 管理用户导航区域的展开状态
 * - 通过 SecondaryNavContext 管理二级导航内容
 * - 路由匹配自动判断一级导航的激活状态
 *
 * 响应式设计：
 * - 大屏（md+）：显示完整 Sidebar 和二级导航
 * - 小屏（<md）：Sidebar 可折叠，二级导航以下拉菜单形式展示
 */

import type { CSSProperties, ReactNode } from 'react'
import type { User } from '@libs/auth-web'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'

import { isKey, useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-core'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icons,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar
} from '@libs/ui-web'

import { pathsConfig } from '../../../../config/paths'
import { AccountSwitcher } from '../../../../modules/organization/account-switcher'
import { GoLink } from '../../go-link'
import { AppHeader } from './app-header'
import { useNavigationStore } from './navigation-store'
import { useSecondaryNav } from './secondary-nav-context'
import { getUserNavMobileItems, UserSecondaryNav } from './user-secondary-nav'

// ============================================================================
// 类型导出
// ============================================================================

export type { SecondaryNavItem, SecondaryNavConfig, CustomSecondaryNavValue } from './secondary-nav-context'
export { SecondaryNavProvider, useSecondaryNav } from './secondary-nav-context'
export type { NavItem, NavGroup, NavStatCard, NavProgress } from './nav-config'
export { flattenNavConfig, getDefaultSubRoute } from './nav-config'
export { SecondaryNavRenderer } from './secondary-nav-renderer'

// ============================================================================
// 类型定义
// ============================================================================

/** 子菜单项 */
export interface AppShellSubItem {
  /** 菜单项图标 */
  icon: ReactNode
  /** 菜单项标签（翻译 key 或显示文本） */
  label: string
  /** 跳转路径 */
  href: string
}

/**
 * 一级导航菜单项
 * 包含 subItems 用于折叠模式和小屏模式下显示二级导航
 */
export interface AppShellMenuItem {
  /** 菜单项图标 */
  icon: ReactNode
  /** 菜单项标签（翻译 key 或显示文本） */
  label: string
  /** 用于路由匹配判断高亮状态的路径前缀 */
  href: string
  /**
   * 默认子路由路径
   * 当用户首次点击该菜单项时，如果没有访问记录，将跳转到此路径
   * 如果不提供，则默认跳转到 href
   */
  defaultSubRoute?: string
  /**
   * 子菜单项列表
   * 用于折叠模式（hover 显示 dropdown）和小屏模式（展开显示子菜单）
   */
  subItems?: AppShellSubItem[]
}

/** AppShell 组件属性 */
interface AppShellProps {
  /** 当前登录用户信息 */
  readonly user: User
  /** 一级导航菜单配置 */
  readonly menu: AppShellMenuItem[]
  /** 页面主内容 */
  readonly children: ReactNode
  /** Header 右侧的自定义操作按钮 */
  readonly headerActions?: ReactNode
}

// ============================================================================
// 常量定义
// ============================================================================

/** 鼠标悬停打开下拉菜单的延迟时间（毫秒） */
const HOVER_OPEN_DELAY = 100
/** 鼠标离开关闭下拉菜单的延迟时间（毫秒） */
const HOVER_CLOSE_DELAY = 200
/** 用户导航的路径前缀（用于判断用户导航是否激活） */
const USER_NAV_PATHS = ['/user']

// ============================================================================
// 内部组件：AppShellInner
// ============================================================================

const AppShellInner = memo<AppShellProps>(({ user, menu, children, headerActions }) => {
  const { t, i18n } = useTranslation('common')
  const { setOpenMobile } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()
  const secondaryNav = useSecondaryNav()

  // 从 Zustand store 获取导航状态和操作
  const userNavExpanded = useNavigationStore(state => state.userNavExpanded)
  const setUserNavExpanded = useNavigationStore(state => state.setUserNavExpanded)
  const setLastVisitedRoute = useNavigationStore(state => state.setLastVisitedRoute)
  const getLastVisitedRoute = useNavigationStore(state => state.getLastVisitedRoute)

  // 本地状态
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [hoveredMenu, setHoveredMenu] = useState<number | null>(null)
  const [hoveredUserNav, setHoveredUserNav] = useState(false)

  // 定时器引用
  const openTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHoveringRef = useRef(false)

  // ============================================================================
  // 路由匹配逻辑
  // ============================================================================

  /**
   * 判断一级导航菜单项是否激活
   * 基于当前路由路径进行匹配
   */
  const isMenuActive = useCallback(
    (menuHref: string) => {
      const currentPath = location.pathname
      // 精确匹配或前缀匹配（确保是路径边界）
      return currentPath === menuHref || currentPath.startsWith(menuHref + '/')
    },
    [location.pathname]
  )

  /**
   * 判断用户导航是否激活
   * 当前路径以 /user 开头时激活
   */
  const isUserNavActive = useCallback(() => {
    const currentPath = location.pathname
    return USER_NAV_PATHS.some(prefix => currentPath === prefix || currentPath.startsWith(prefix + '/'))
  }, [location.pathname])

  // ============================================================================
  // 根据路由变化自动管理导航状态
  // ============================================================================

  useEffect(() => {
    const currentPath = location.pathname
    const isInUserNav = isUserNavActive()

    // 1. 如果当前在用户路由且用户导航未展开，自动展开
    // 这处理了直接访问用户路由（如刷新页面）的情况
    if (isInUserNav && !userNavExpanded) {
      setUserNavExpanded(true)
    }

    // 2. 记录当前访问的路由到对应模块
    // 遍历所有菜单项，找到匹配的模块并记录
    for (const item of menu) {
      if (currentPath.startsWith(item.href + '/') || currentPath === item.href) {
        // 只记录子路由，不记录模块根路由
        if (currentPath !== item.href) {
          setLastVisitedRoute(item.href, currentPath)
        }
        break
      }
    }

    // 3. 记录用户导航的路由
    for (const prefix of USER_NAV_PATHS) {
      if (currentPath.startsWith(prefix + '/') || currentPath === prefix) {
        if (currentPath !== prefix) {
          setLastVisitedRoute(prefix, currentPath)
        }
        break
      }
    }
  }, [location.pathname, menu]) // 监听路由变化

  // ============================================================================
  // 一级导航点击处理
  // ============================================================================

  /**
   * 处理一级导航菜单项点击
   * 无论二级导航是否折叠，都执行跳转：
   * - 首次点击：跳转到默认子路由
   * - 非首次点击：跳转到最后访问的子路由
   */
  const handleMenuItemClick = useCallback(
    (item: AppShellMenuItem, e: React.MouseEvent) => {
      // 阻止默认跳转行为，统一由 navigate 处理
      e.preventDefault()

      // 获取目标路由：最后访问的子路由 > 默认子路由 > 模块根路由
      const defaultPath = item.defaultSubRoute || item.href
      const targetPath = getLastVisitedRoute(item.href, defaultPath)

      // 如果已经在目标路径，不需要跳转
      if (location.pathname === targetPath) {
        return
      }

      void navigate({ to: targetPath })
    },
    [location.pathname, getLastVisitedRoute, navigate]
  )

  // ============================================================================
  // 鼠标悬停相关逻辑（用于折叠模式下的下拉菜单）
  // ============================================================================

  /** 清除所有定时器 */
  const clearAllTimeouts = useCallback(() => {
    if (openTimeoutRef.current) {
      clearTimeout(openTimeoutRef.current)
      openTimeoutRef.current = null
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  /** 处理菜单项鼠标进入 */
  const handleMenuHover = useCallback(
    (index: number) => {
      isHoveringRef.current = true
      clearAllTimeouts()

      if (hoveredMenu !== null && hoveredMenu !== index) {
        setHoveredMenu(index)
        return
      }

      openTimeoutRef.current = setTimeout(() => {
        if (isHoveringRef.current) {
          setHoveredMenu(index)
        }
      }, HOVER_OPEN_DELAY)
    },
    [clearAllTimeouts, hoveredMenu]
  )

  /** 处理菜单项鼠标离开 */
  const handleMenuLeave = useCallback(() => {
    isHoveringRef.current = false
    clearAllTimeouts()

    closeTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        setHoveredMenu(null)
      }
    }, HOVER_CLOSE_DELAY)
  }, [clearAllTimeouts])

  /** 处理下拉内容鼠标进入 */
  const handleDropdownContentEnter = useCallback(() => {
    isHoveringRef.current = true
    clearAllTimeouts()
  }, [clearAllTimeouts])

  /** 处理下拉内容鼠标离开 */
  const handleDropdownContentLeave = useCallback(() => {
    isHoveringRef.current = false
    clearAllTimeouts()

    closeTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        setHoveredMenu(null)
      }
    }, HOVER_CLOSE_DELAY)
  }, [clearAllTimeouts])

  /** 处理子菜单项点击 */
  const handleSubItemClick = useCallback(() => {
    clearAllTimeouts()
    setHoveredMenu(null)
    isHoveringRef.current = false
    setOpenMobile(false)
  }, [clearAllTimeouts, setOpenMobile])

  // ============================================================================
  // 用户导航悬停逻辑（折叠模式）
  // ============================================================================

  /** 处理用户头像鼠标进入 */
  const handleUserNavHover = useCallback(() => {
    clearAllTimeouts()
    openTimeoutRef.current = setTimeout(() => {
      setHoveredUserNav(true)
    }, HOVER_OPEN_DELAY)
  }, [clearAllTimeouts])

  /** 处理用户头像鼠标离开 */
  const handleUserNavLeave = useCallback(() => {
    clearAllTimeouts()
    closeTimeoutRef.current = setTimeout(() => {
      setHoveredUserNav(false)
    }, HOVER_CLOSE_DELAY)
  }, [clearAllTimeouts])

  // ============================================================================
  // 工具函数
  // ============================================================================

  /** 翻译标签文本 */
  const translateLabel = (label: string) => (isKey(label, i18n, 'common') ? t(label) : label)

  // ============================================================================
  // 导航状态计算
  // ============================================================================

  // 查找当前激活的菜单项
  const activeMenuItem = menu.find(item => isMenuActive(item.href))

  // 判断是否有模块二级导航（基于路由配置，不依赖实际渲染）
  const hasSecondaryNav = Boolean(
    secondaryNav?.desktopContent || (activeMenuItem?.subItems && activeMenuItem.subItems.length > 0)
  )

  // 模块二级导航的实际内容是否已挂载（SecondaryNavProvider 已渲染）
  const moduleNavContentReady = Boolean(secondaryNav?.desktopContent)

  // 用户导航的移动端菜单项
  const userNavMobileItems = getUserNavMobileItems(t)

  // 判断是否显示用户的二级导航
  // 当从用户路由导航到模块路由时，SecondaryNavProvider 需要一帧才能挂载，
  // 期间 moduleNavContentReady 为 false。保留用户导航作为视觉占位，
  // 直到模块导航内容就绪后再切换，避免二级导航先折叠再展开的闪烁
  const showUserSecondaryNav = userNavExpanded && (isUserNavActive() || !hasSecondaryNav || !moduleNavContentReady)

  // 判断是否显示模块的二级导航
  const showModuleSecondaryNav = hasSecondaryNav && moduleNavContentReady && !showUserSecondaryNav

  // ============================================================================
  // 渲染
  // ============================================================================

  return (
    <>
      {/* ========== 一级导航 Sidebar ========== */}
      <Sidebar collapsible="icon" className="**:data-[slot=sidebar-inner]:bg-card">
        {/* 账户切换器（个人 / 组织） */}
        <SidebarHeader>
          <AccountSwitcher user={user} />
        </SidebarHeader>

        {/* 主菜单区域 */}
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menu.map((item, index) => {
                  const isActive = isMenuActive(item.href)

                  return (
                    <Collapsible
                      key={item.label}
                      open={expandedMenu === item.label}
                      onOpenChange={open => setExpandedMenu(open ? item.label : null)}
                    >
                      <SidebarMenuItem>
                        {/* 大屏展开状态：点击跳转到最后访问的子路由或默认子路由 */}
                        {sidebarVisible && (
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            className="[&>svg]:text-primary hidden group-data-[collapsible=icon]:size-10! md:flex [&>svg]:size-6"
                            tooltip={translateLabel(item.label)}
                          >
                            <GoLink href={item.href} onClick={e => handleMenuItemClick(item, e)}>
                              {item.icon}
                              <span>{translateLabel(item.label)}</span>
                            </GoLink>
                          </SidebarMenuButton>
                        )}

                        {/* 大屏折叠状态：hover 显示下拉菜单，点击跳转到对应路由 */}
                        {!sidebarVisible && (
                          <DropdownMenu open={hoveredMenu === index} modal={false}>
                            <DropdownMenuTrigger asChild>
                              <SidebarMenuButton
                                isActive={isActive}
                                className="[&>svg]:text-primary hidden group-data-[collapsible=icon]:size-10! md:flex [&>svg]:size-6"
                                onMouseEnter={() => handleMenuHover(index)}
                                onMouseLeave={handleMenuLeave}
                                onClick={() => {
                                  // 点击跳转到对应路由（与展开模式行为一致）
                                  const defaultPath = item.defaultSubRoute || item.href
                                  const targetPath = getLastVisitedRoute(item.href, defaultPath)
                                  if (location.pathname !== targetPath) {
                                    void navigate({ to: targetPath })
                                  }
                                }}
                              >
                                {item.icon}
                                <span>{translateLabel(item.label)}</span>
                              </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            {item.subItems && item.subItems.length > 0 && (
                              <DropdownMenuContent
                                side="right"
                                align="start"
                                sideOffset={8}
                                className="w-48"
                                onMouseEnter={handleDropdownContentEnter}
                                onMouseLeave={handleDropdownContentLeave}
                              >
                                <DropdownMenuLabel>{translateLabel(item.label)}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {/* 折叠模式下的二级菜单不显示选中状态 */}
                                {item.subItems.map(subItem => (
                                  <DropdownMenuItem key={subItem.label} asChild onClick={handleSubItemClick}>
                                    <GoLink href={subItem.href} className="flex items-center gap-2">
                                      {subItem.icon}
                                      <span>{translateLabel(subItem.label)}</span>
                                    </GoLink>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            )}
                          </DropdownMenu>
                        )}

                        {/* 小屏模式：可折叠的子菜单 */}
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            isActive={isActive}
                            className="[&>svg]:text-primary md:hidden [&>svg]:size-6"
                            tooltip={translateLabel(item.label)}
                          >
                            {item.icon}
                            <span className="flex-1">{translateLabel(item.label)}</span>
                            {item.subItems && item.subItems.length > 0 && (
                              <Icons.ChevronRight
                                className={cn(
                                  'text-muted-foreground size-4 transition-transform',
                                  expandedMenu === item.label && 'rotate-90'
                                )}
                              />
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>

                        {/* 小屏模式：展开的子菜单内容（不显示选中状态） */}
                        {item.subItems && item.subItems.length > 0 && (
                          <CollapsibleContent className="md:hidden">
                            <div className="border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5">
                              {item.subItems.map(subItem => (
                                <GoLink
                                  key={subItem.label}
                                  href={subItem.href}
                                  onClick={() => setOpenMobile(false)}
                                  className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm"
                                >
                                  {subItem.icon}
                                  <span>{translateLabel(subItem.label)}</span>
                                </GoLink>
                              ))}
                            </div>
                          </CollapsibleContent>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ========== 用户头像区域（Sidebar 底部） ========== */}
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              {/* 大屏展开状态：点击跳转到用户路由 */}
              {sidebarVisible && (
                <SidebarMenuButton
                  isActive={isUserNavActive()}
                  className="hidden h-auto py-2 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-1! md:flex [&>svg]:size-6"
                  tooltip={user.name ?? t('account')}
                  onClick={() => {
                    // 确保用户导航展开
                    if (!userNavExpanded) {
                      setUserNavExpanded(true)
                    }
                    // 跳转到用户路由：最后访问的 > 默认设置页
                    const targetPath = getLastVisitedRoute('/user', pathsConfig.user.profile)
                    if (location.pathname !== targetPath) {
                      void navigate({ to: targetPath })
                    }
                  }}
                >
                  <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                    <Icons.UserRound className="size-5" />
                  </span>
                  <div className="flex flex-1 flex-col items-start overflow-hidden group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                  </div>
                  <Icons.ChevronRight
                    className={cn(
                      'text-muted-foreground size-4 shrink-0 transition-transform group-data-[collapsible=icon]:hidden',
                      userNavExpanded && 'rotate-90'
                    )}
                  />
                </SidebarMenuButton>
              )}

              {/* 大屏折叠状态：hover 显示用户菜单下拉，点击跳转到用户路由 */}
              {!sidebarVisible && (
                <DropdownMenu open={hoveredUserNav} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton
                      isActive={isUserNavActive()}
                      className="hidden h-auto py-2 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-1! md:flex"
                      onMouseEnter={handleUserNavHover}
                      onMouseLeave={handleUserNavLeave}
                      onClick={() => {
                        // 点击跳转到用户路由（与展开模式行为一致）
                        const targetPath = getLastVisitedRoute('/user', pathsConfig.user.profile)
                        if (location.pathname !== targetPath) {
                          void navigate({ to: targetPath })
                        }
                      }}
                    >
                      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                        <Icons.UserRound className="size-5" />
                      </span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="right"
                    align="end"
                    sideOffset={8}
                    className="w-48"
                    onMouseEnter={handleDropdownContentEnter}
                    onMouseLeave={() => {
                      handleDropdownContentLeave()
                      setHoveredUserNav(false)
                    }}
                  >
                    <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {/* 折叠模式下的用户菜单不显示选中状态 */}
                    {userNavMobileItems.map(item => (
                      <DropdownMenuItem key={item.href} asChild onClick={handleSubItemClick}>
                        <GoLink href={item.href} className="flex items-center gap-2">
                          {item.icon}
                          <span>{translateLabel(item.label)}</span>
                        </GoLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* 小屏模式：可折叠的用户菜单 */}
              <Collapsible
                open={expandedMenu === 'user'}
                onOpenChange={open => setExpandedMenu(open ? 'user' : null)}
                className="md:hidden"
              >
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton isActive={isUserNavActive()} className="h-auto py-2 [&>svg]:size-6">
                    <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                      <Icons.UserRound className="size-5" />
                    </span>
                    <div className="flex flex-1 flex-col items-start overflow-hidden">
                      <span className="truncate text-sm font-medium">{user.name}</span>
                      <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                    </div>
                    <Icons.ChevronRight
                      className={cn(
                        'text-muted-foreground size-4 shrink-0 transition-transform',
                        expandedMenu === 'user' && 'rotate-90'
                      )}
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>
                {/* 小屏模式下的用户菜单不显示选中状态 */}
                <CollapsibleContent>
                  <div className="border-sidebar-border mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l px-2.5 py-0.5">
                    {userNavMobileItems.map(item => (
                      <GoLink
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenMobile(false)}
                        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm"
                      >
                        {item.icon}
                        <span>{translateLabel(item.label)}</span>
                      </GoLink>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* ========== 二级导航区域 ========== */}
      {sidebarVisible && (
        <>
          {/* 用户二级导航 */}
          {showUserSecondaryNav && (
            <div className="bg-muted sticky top-0 flex h-dvh w-65 flex-col border-r max-md:hidden">
              <UserSecondaryNav user={user} />
            </div>
          )}

          {/* 模块二级导航（showModuleSecondaryNav 已确保 desktopContent 非空） */}
          {showModuleSecondaryNav && (
            <div className="bg-muted sticky top-0 flex h-dvh w-65 flex-col border-r max-md:hidden">
              <div className="flex flex-1 flex-col overflow-y-auto">{secondaryNav!.desktopContent}</div>
            </div>
          )}
        </>
      )}

      {/* ========== 主内容区域 ========== */}
      <div className="flex flex-1 flex-col">
        {/* 顶部 Header（不再包含用户头像） */}
        <AppHeader
          onToggleSidebar={() => setSidebarVisible(prev => !prev)}
          actions={headerActions}
          showSidebarToggle={hasSecondaryNav || showUserSecondaryNav}
        />

        {/* 页面主内容 */}
        <main className="size-full flex-1 px-4 py-6 sm:px-6">{children}</main>

        {/* 页脚 */}
        <footer className="flex items-center justify-between gap-3 px-4 py-3 max-md:flex-col sm:px-6 md:gap-6">
          <p className="text-muted-foreground max-md:text-center text-sm text-balance">
            {`©${new Date().getFullYear()}`} Ray
          </p>
        </footer>
      </div>
    </>
  )
})

AppShellInner.displayName = 'AppShellInner'

// ============================================================================
// 主组件：AppShell
// ============================================================================

/**
 * AppShell 组件
 *
 * 应用的主布局框架，包装 SidebarProvider 提供 Sidebar 上下文。
 *
 * @example
 * ```tsx
 * <AppShell user={currentUser} menu={menuItems}>
 *   <SecondaryNavProvider value={{ desktopContent: <MySecondaryNav /> }}>
 *     <MyPageContent />
 *   </SecondaryNavProvider>
 * </AppShell>
 * ```
 */
export const AppShell = memo<AppShellProps>(props => {
  return (
    <div className="flex min-h-dvh w-full">
      <SidebarProvider defaultOpen={false} style={{ '--sidebar-width-icon': '3.5625rem' } as CSSProperties}>
        <AppShellInner {...props} />
      </SidebarProvider>
    </div>
  )
})

AppShell.displayName = 'AppShell'
