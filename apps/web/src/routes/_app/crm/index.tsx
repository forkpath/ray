import { createFileRoute } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { OrganizationPicker, PageHeader, PageHeaderDescription, PageHeaderTitle } from '@libs/studio'

export const Route = createFileRoute('/_app/crm/')({
  component: DashboardPage
})

function DashboardPage() {
  const { t } = useTranslation('dashboard')

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader>
        <div className="flex flex-col gap-1.5">
          <PageHeaderTitle>{t('home.title')}</PageHeaderTitle>
          <PageHeaderDescription>{t('home.description')}</PageHeaderDescription>
        </div>
      </PageHeader>

      <OrganizationPicker />
    </div>
  )
}
