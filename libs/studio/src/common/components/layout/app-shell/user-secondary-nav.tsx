/**
 * 用户二级导航组件
 *
 * 当用户点击 Sidebar 底部的用户头像时，显示此二级导航内容。
 * 包含用户相关的菜单项：个人资料、设置、账单等。
 */

'use client'

import type { ReactNode } from 'react'
import type { User } from '@libs/auth'

import { memo, useCallback } from 'react'
import { Link, useLocation } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-shared/common'
import { Avatar, AvatarFallback, AvatarImage, Button, Icons } from '@libs/ui-shared/web'

import { pathsConfig } from '../../../../config/paths'
import { authClient } from '../../../../lib/auth/client'

// ============================================================================
// 类型定义
// ============================================================================

/** 用户导航菜单项 */
interface UserNavItem {
  /** 菜单项图标 */
  icon: ReactNode
  /** 菜单项标签（翻译 key 或显示文本） */
  label: string
  /** 跳转路径 */
  href: string
}

/** UserSecondaryNav 组件属性 */
interface UserSecondaryNavProps {
  /** 当前登录用户信息 */
  readonly user: User
}

// ============================================================================
// 子组件：导航菜单项
// ============================================================================

interface NavItemProps {
  readonly item: UserNavItem
  readonly isActive: boolean
}

const NavItem = memo<NavItemProps>(({ item, isActive }) => {
  return (
    <Link
      to={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
        'hover:bg-accent',
        isActive ? 'text-primary font-medium' : 'text-foreground'
      )}
    >
      <span className={cn('[&>svg]:size-4', isActive ? 'text-primary' : 'text-muted-foreground')}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  )
})

NavItem.displayName = 'NavItem'

// ============================================================================
// 主组件：用户二级导航
// ============================================================================

export const UserSecondaryNav = memo<UserSecondaryNavProps>(({ user }) => {
  const { t } = useTranslation(['common'])
  const location = useLocation()

  const isActive = useCallback((href: string) => location.pathname === href, [location.pathname])

  const handleLogout = useCallback(() => {
    void authClient.signOut()
  }, [])

  const accountItems: UserNavItem[] = [
    {
      icon: <Icons.User className="size-4" />,
      label: t('account'),
      href: pathsConfig.user.profile
    },
    {
      icon: <Icons.CreditCard className="size-4" />,
      label: t('billing'),
      href: pathsConfig.user.billing
    },
    {
      icon: <Icons.Lock className="size-4" />,
      label: t('security'),
      href: pathsConfig.user.security
    }
  ]

  return (
    <div className="flex h-full flex-col">
      {/* 用户信息头部 */}
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="size-12">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? ''} />
              <AvatarFallback className="text-lg">{user.name?.slice(0, 2).toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <span className="ring-card absolute right-0 bottom-0 block size-3 rounded-full bg-green-500 ring-2" />
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="text-foreground truncate font-semibold">{user.name}</span>
            <span className="text-muted-foreground truncate text-sm">{user.email}</span>
          </div>
        </div>
      </div>

      {/* 导航菜单区域（可滚动） */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-4">
          <span className="text-muted-foreground mb-2 block px-3 text-xs font-medium uppercase">{t('account')}</span>
          <nav className="flex flex-col gap-0.5">
            {accountItems.map(item => (
              <NavItem key={item.href} item={item} isActive={isActive(item.href)} />
            ))}
          </nav>
        </div>
      </div>

      {/* 底部操作区域 */}
      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full justify-start gap-3"
          onClick={handleLogout}
        >
          <Icons.LogOut className="size-4" />
          <span>{t('logout.cta')}</span>
        </Button>
      </div>
    </div>
  )
})

UserSecondaryNav.displayName = 'UserSecondaryNav'

// ============================================================================
// 导出用于移动端的菜单项列表
// ============================================================================

/**
 * 获取用户导航的移动端菜单项
 * 用于 Sidebar 折叠时的下拉菜单
 */
export function getUserNavMobileItems(t: (key: string) => string): { icon: ReactNode; label: string; href: string }[] {
  return [
    {
      icon: <Icons.User className="size-4" />,
      label: t('account.profile'),
      href: pathsConfig.user.profile
    },
    {
      icon: <Icons.CreditCard className="size-4" />,
      label: t('billing'),
      href: pathsConfig.user.billing
    },
    {
      icon: <Icons.Lock className="size-4" />,
      label: t('security'),
      href: pathsConfig.user.security
    }
  ]
}
