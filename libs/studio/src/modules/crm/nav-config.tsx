/**
 * CRM 模块导航配置
 *
 * 统一定义 CRM 模块的所有导航项，确保数据源唯一。
 * 无论是大屏展开、小屏折叠还是移动端，都使用同一份配置。
 */

import type { SecondaryNavConfig } from '../../common/components/layout/app-shell/nav-config'
import type { TFunction } from 'i18next'

import { Icons } from '@libs/ui-web'

import { pathsConfig } from '../../config/paths'

/**
 * 获取 CRM 模块的二级导航配置
 *
 * @param t 翻译函数
 * @returns CRM 二级导航配置
 *
 * @example
 * ```tsx
 * const { t } = useTranslation(['common', 'dashboard'])
 * const crmNavConfig = getCrmNavConfig(t)
 * ```
 */
export function getCrmNavConfig(t: TFunction<['common', 'dashboard']>): SecondaryNavConfig {
  const CRM_PREFIX = pathsConfig.crm.index

  return {
    title: 'CRM',
    // 统计卡片
    stats: [
      { label: t('dashboard:stats.deliveries'), value: '25.9k' },
      { label: t('dashboard:stats.onTheWay'), value: '4.6k' }
    ],
    // 进度指示器
    progress: {
      label: t('dashboard:stats.deliveryProcess'),
      value: 30,
      description: t('dashboard:stats.reachedTarget', { percent: 30 })
    },
    // 快捷入口（网格显示）
    quickAccess: [
      {
        label: t('dashboard:pages.dashboard'),
        href: pathsConfig.crm.index,
        icon: <Icons.LayoutDashboard />
      },
      {
        label: t('dashboard:pages.sales'),
        href: pathsConfig.crm.ai,
        icon: <Icons.TrendingUp />
      },
      {
        label: t('dashboard:pages.order'),
        href: pathsConfig.crm.order.index,
        icon: <Icons.ShoppingCart />
      },
      {
        label: t('dashboard:pages.shipping'),
        href: pathsConfig.crm.invoice.index,
        icon: <Icons.Truck />
      }
    ],
    // 导航分组
    groups: [
      {
        title: t('dashboard:groups.clients'),
        items: [
          {
            label: t('dashboard:clients.accounts'),
            href: pathsConfig.crm.customer.index,
            icon: <Icons.Users />
          },
          {
            label: t('dashboard:clients.activity'),
            href: `${CRM_PREFIX}/activity`,
            icon: <Icons.Activity />
          },
          {
            label: t('dashboard:clients.logins'),
            href: `${CRM_PREFIX}/logins`,
            icon: <Icons.LogIn />
          },
          {
            label: t('dashboard:clients.pricing'),
            href: `${CRM_PREFIX}/pricing`,
            icon: <Icons.CreditCard />
          }
        ]
      },
      {
        title: t('dashboard:groups.billing'),
        items: [
          {
            label: t('dashboard:billing.adjustments'),
            href: `${CRM_PREFIX}/adjustments`,
            icon: <Icons.Settings2 />
          },
          {
            label: t('dashboard:billing.payments'),
            href: pathsConfig.crm.payment.index,
            icon: <Icons.HandCoins />
          },
          {
            label: t('dashboard:billing.statements'),
            href: `${CRM_PREFIX}/statements`,
            icon: <Icons.FileText />
          },
          {
            label: t('dashboard:billing.accountSummary'),
            href: `${CRM_PREFIX}/account-summary`,
            icon: <Icons.ClipboardList />
          },
          {
            label: t('dashboard:billing.exportInvoices'),
            href: `${CRM_PREFIX}/export-invoices`,
            icon: <Icons.Download />
          }
        ]
      }
    ]
  }
}
