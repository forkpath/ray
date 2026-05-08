import { useMemo } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { getCrmNavConfig, SecondaryNavProvider } from '@libs/studio'

// CRM 路由 Layout - 提供二级导航
export const Route = createFileRoute('/_app/crm')({
  component: CrmLayout
})

function CrmLayout() {
  const { t } = useTranslation(['common', 'dashboard'])

  // 使用统一的导航配置（数据源唯一）
  const navConfig = useMemo(() => getCrmNavConfig(t as Parameters<typeof getCrmNavConfig>[0]), [t])

  return (
    // 配置式 SecondaryNavProvider：自动生成 desktopContent 和 mobileItems
    <SecondaryNavProvider config={navConfig} quickAccessTitle={t('dashboard:pages.title')}>
      <Outlet />
    </SecondaryNavProvider>
  )
}
