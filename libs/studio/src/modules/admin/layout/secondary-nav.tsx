import { useLocation } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-core'
import { Icons } from '@libs/ui-web'

import { GoLink } from '../../../common/components/go-link'
import { pathsConfig } from '../../../config/paths'

/**
 * Admin 二级导航 - 简单的链接列表
 */
export function AdminSecondaryNav() {
  const { t } = useTranslation('common')
  const location = useLocation()

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/')

  const menuItems = [
    {
      label: t('users'),
      href: pathsConfig.admin.users.index,
      icon: <Icons.UsersRound className="size-4" />
    },
    {
      label: t('organizations'),
      href: pathsConfig.admin.organizations.index,
      icon: <Icons.Building className="size-4" />
    },
    {
      label: t('customers'),
      href: pathsConfig.admin.customers.index,
      icon: <Icons.HandCoins className="size-4" />
    }
  ]

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-foreground text-lg font-semibold">{t('admin')}</h2>

      <nav className="flex flex-col gap-1">
        {menuItems.map(item => (
          <GoLink
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              isActive(item.href) && 'bg-accent text-accent-foreground'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </GoLink>
        ))}
      </nav>
    </div>
  )
}
