import { createFileRoute } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '@libs/studio'

export const Route = createFileRoute('/_app/crm/ai')({
  component: AIPage
})

function AIPage() {
  const { t } = useTranslation('dashboard')

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader>
        <div className="flex flex-col gap-1.5">
          <PageHeaderTitle>{t('ai.title')}</PageHeaderTitle>
          <PageHeaderDescription>{t('ai.description')}</PageHeaderDescription>
        </div>
      </PageHeader>

      <div className="text-muted-foreground">AI Demo - Coming Soon</div>
    </div>
  )
}
