/**
 * 二级导航渲染组件
 *
 * 根据 SecondaryNavConfig 配置自动渲染二级导航内容。
 * 支持多种 UI 元素：统计卡片、进度指示器、快捷入口、分组导航列表。
 */

'use client'

import type { SecondaryNavConfig } from './nav-config'

import { memo, useCallback } from 'react'
import { Link, useLocation } from '@tanstack/react-router'

import { cn } from '@libs/ui-core'

// ============================================================================
// 子组件：统计卡片
// ============================================================================

interface StatCardProps {
  readonly label: string
  readonly value: string | number
}

const StatCard = memo<StatCardProps>(({ label, value }) => {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  )
})

StatCard.displayName = 'StatCard'

// ============================================================================
// 子组件：进度指示器
// ============================================================================

interface ProgressIndicatorProps {
  readonly label: string
  readonly value: number
  readonly description?: string
}

const ProgressIndicator = memo<ProgressIndicatorProps>(({ label, value, description }) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-sm">{label}</span>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {description && <span className="text-muted-foreground text-xs">{description}</span>}
    </div>
  )
})

ProgressIndicator.displayName = 'ProgressIndicator'

// ============================================================================
// 子组件：快捷入口网格
// ============================================================================

interface QuickAccessGridProps {
  readonly items: SecondaryNavConfig['quickAccess']
  readonly isActive: (href: string) => boolean
}

const QuickAccessGrid = memo<QuickAccessGridProps>(({ items, isActive }) => {
  if (!items || items.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(item => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
              // hover 状态：改变背景
              'hover:bg-accent',
              // 选中状态：主题色边框 + 主题色文本（无背景）
              active ? 'border-primary text-primary' : 'text-foreground'
            )}
          >
            <span className={cn('[&>svg]:size-6', active ? 'text-primary' : 'text-muted-foreground')}>{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
})

QuickAccessGrid.displayName = 'QuickAccessGrid'

// ============================================================================
// 子组件：导航分组
// ============================================================================

interface NavGroupSectionProps {
  readonly title?: string
  readonly items: SecondaryNavConfig['groups'][number]['items']
  readonly isActive: (href: string) => boolean
}

const NavGroupSection = memo<NavGroupSectionProps>(({ title, items, isActive }) => {
  return (
    <div className="flex flex-col gap-2">
      {title && <span className="text-muted-foreground text-sm">{title}</span>}
      <nav className="flex flex-col gap-0.5">
        {items.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                // hover 状态：改变背景
                'hover:bg-accent',
                // 选中状态：改变文本颜色（无背景）
                active ? 'text-primary font-medium' : 'text-foreground'
              )}
            >
              <span className={cn('[&>svg]:size-4', active ? 'text-primary' : 'text-muted-foreground')}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
})

NavGroupSection.displayName = 'NavGroupSection'

// ============================================================================
// 主组件：二级导航渲染器
// ============================================================================

interface SecondaryNavRendererProps {
  /** 导航配置 */
  readonly config: SecondaryNavConfig
  /** 页面部分标题（可选，用于统计/进度区域的标题） */
  readonly sectionTitle?: string
}

/**
 * 二级导航渲染器
 *
 * 根据配置自动渲染完整的二级导航内容，包括：
 * - 统计卡片（网格显示）
 * - 进度指示器
 * - 快捷入口（网格显示）
 * - 分组导航列表
 *
 * @example
 * ```tsx
 * <SecondaryNavRenderer config={crmNavConfig} />
 * ```
 */
export const SecondaryNavRenderer = memo<SecondaryNavRendererProps>(({ config, sectionTitle }) => {
  const location = useLocation()

  // 判断路径是否激活（精确匹配路由）
  const isActive = useCallback((href: string) => location.pathname === href, [location.pathname])

  const hasStats = config.stats && config.stats.length > 0
  const hasProgress = !!config.progress
  const hasQuickAccess = config.quickAccess && config.quickAccess.length > 0
  const hasGroups = config.groups.length > 0

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* 统计卡片区域 */}
      {hasStats && (
        <div className="grid grid-cols-2 gap-3">
          {config.stats!.map((stat, index) => (
            <StatCard key={index} label={stat.label} value={stat.value} />
          ))}
        </div>
      )}

      {/* 进度指示器 */}
      {hasProgress && (
        <ProgressIndicator
          label={config.progress!.label}
          value={config.progress!.value}
          description={config.progress!.description}
        />
      )}

      {/* 快捷入口 */}
      {hasQuickAccess && (
        <div className="flex flex-col gap-2">
          {sectionTitle && <span className="text-muted-foreground text-sm">{sectionTitle}</span>}
          <QuickAccessGrid items={config.quickAccess} isActive={isActive} />
        </div>
      )}

      {/* 导航分组列表 */}
      {hasGroups &&
        config.groups.map((group, index) => (
          <NavGroupSection key={group.title || index} title={group.title} items={group.items} isActive={isActive} />
        ))}
    </div>
  )
})

SecondaryNavRenderer.displayName = 'SecondaryNavRenderer'
