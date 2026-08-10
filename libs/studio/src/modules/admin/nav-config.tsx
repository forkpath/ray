/**
 * Admin 模块导航配置
 *
 * 统一定义 Admin 模块的所有导航项，确保数据源唯一。
 * 无论是大屏展开、小屏折叠还是移动端，都使用同一份配置。
 */

import type { SecondaryNavConfig } from '../../common/components/layout/app-shell/nav-config'
import type { TFunction } from 'i18next'

import { Icons } from '@libs/ui-web'

import { pathsConfig } from '../../config/paths'

/**
 * 获取 Admin 模块的二级导航配置
 *
 * @param t 翻译函数
 * @returns Admin 二级导航配置
 *
 * @example
 * ```tsx
 * const { t } = useTranslation('common')
 * const adminNavConfig = getAdminNavConfig(t)
 * ```
 */
export function getAdminNavConfig(t: TFunction<'common'>): SecondaryNavConfig {
  return {
    title: t('admin'),
    // Admin 模块没有统计卡片和进度指示器
    // 直接显示导航列表
    groups: [
      {
        // 不需要分组标题，Admin 的导航比较简单
        items: [
          {
            label: t('users'),
            href: pathsConfig.admin.users.index,
            icon: <Icons.UsersRound />
          },
          {
            label: t('organizations'),
            href: pathsConfig.admin.organizations.index,
            icon: <Icons.Building />
          },
          {
            label: t('customers'),
            href: pathsConfig.admin.customers.index,
            icon: <Icons.HandCoins />
          }
        ]
      }
    ]
  }
}
