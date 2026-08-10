import type { ReactNode } from 'react'

import { Link, useLocation } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-core'
import { Icons } from '@libs/ui-web'

import { pathsConfig } from '../../../config/paths'

interface NavItem {
  label: string
  href: string
  icon: ReactNode
}

interface NavGroup {
  title: string
  items: NavItem[]
}

/**
 * CRM 二级导航 - 复杂的仪表板式布局
 */
export function CrmSecondaryNav() {
  const { t } = useTranslation(['common', 'dashboard'])
  const location = useLocation()

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/')

  // 快捷入口页面（网格卡片）
  const quickPages: NavItem[] = [
    {
      label: t('dashboard:pages.dashboard'),
      href: pathsConfig.crm.index,
      icon: <Icons.LayoutDashboard className="size-6" />
    },
    {
      label: t('dashboard:pages.sales'),
      href: pathsConfig.crm.ai,
      icon: <Icons.TrendingUp className="size-6" />
    },
    {
      label: t('dashboard:pages.order'),
      href: pathsConfig.crm.order.index,
      icon: <Icons.ShoppingCart className="size-6" />
    },
    {
      label: t('dashboard:pages.shipping'),
      href: pathsConfig.crm.invoice.index,
      icon: <Icons.Truck className="size-6" />
    }
  ]

  // 导航分组
  const navGroups: NavGroup[] = [
    {
      title: t('dashboard:groups.clients'),
      items: [
        {
          label: t('dashboard:clients.accounts'),
          href: pathsConfig.crm.customer.index,
          icon: <Icons.Users className="size-4" />
        },
        {
          label: t('dashboard:clients.activity'),
          href: `${pathsConfig.crm.index}/activity`,
          icon: <Icons.Activity className="size-4" />
        },
        {
          label: t('dashboard:clients.logins'),
          href: `${pathsConfig.crm.index}/logins`,
          icon: <Icons.LogIn className="size-4" />
        },
        {
          label: t('dashboard:clients.pricing'),
          href: `${pathsConfig.crm.index}/pricing`,
          icon: <Icons.CreditCard className="size-4" />
        }
      ]
    },
    {
      title: t('dashboard:groups.billing'),
      items: [
        {
          label: t('dashboard:billing.adjustments'),
          href: `${pathsConfig.crm.index}/adjustments`,
          icon: <Icons.Settings2 className="size-4" />
        },
        {
          label: t('dashboard:billing.payments'),
          href: pathsConfig.crm.payment.index,
          icon: <Icons.HandCoins className="size-4" />
        },
        {
          label: t('dashboard:billing.statements'),
          href: `${pathsConfig.crm.index}/statements`,
          icon: <Icons.FileText className="size-4" />
        },
        {
          label: t('dashboard:billing.accountSummary'),
          href: `${pathsConfig.crm.index}/account-summary`,
          icon: <Icons.ClipboardList className="size-4" />
        },
        {
          label: t('dashboard:billing.exportInvoices'),
          href: `${pathsConfig.crm.index}/export-invoices`,
          icon: <Icons.Download className="size-4" />
        }
      ]
    }
  ]

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* 统计卡片区域 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t('dashboard:stats.deliveries')} value="25.9k" />
        <StatCard label={t('dashboard:stats.onTheWay')} value="4.6k" />
      </div>

      {/* 进度指示器 */}
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-sm">{t('dashboard:stats.deliveryProcess')}</span>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div className="bg-primary h-full w-[30%] rounded-full" />
        </div>
        <span className="text-muted-foreground text-xs">{t('dashboard:stats.reachedTarget', { percent: 30 })}</span>
      </div>

      {/* 快捷页面入口（网格） */}
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-sm">{t('dashboard:pages.title')}</span>
        <div className="grid grid-cols-2 gap-2">
          {quickPages.map(page => (
            <Link
              key={page.href}
              to={page.href}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                isActive(page.href) && 'bg-accent border-primary'
              )}
            >
              {page.icon}
              <span className="text-xs">{page.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 导航分组列表 */}
      {navGroups.map(group => (
        <div key={group.title} className="flex flex-col gap-2">
          <span className="text-muted-foreground text-sm">{group.title}</span>
          <nav className="flex flex-col gap-0.5">
            {group.items.map(item => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isActive(item.href) && 'bg-accent text-accent-foreground'
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
    </div>
  )
}
