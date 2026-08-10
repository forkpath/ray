import { useTranslation } from '@libs/i18n'
import { Icons } from '@libs/ui-web'

import { GoLink } from '../../common/components/go-link'
import { pathsConfig } from '../../config/paths'

interface AuthErrorPageProps {
  readonly error?: string
}

export const AuthErrorPage = ({ error }: AuthErrorPageProps) => {
  const { t } = useTranslation(['common', 'auth'])

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Icons.CircleX className="text-destructive size-24" strokeWidth={1.2} />
      <h1 className="text-center text-2xl font-semibold">{t('error.general')}</h1>

      {error && <code className="bg-muted rounded-md px-2 py-0.5 font-mono">{error}</code>}

      <GoLink
        href={pathsConfig.auth.login}
        className="text-muted-foreground hover:text-primary mt-3 text-sm font-medium underline underline-offset-4"
      >
        {t('goToLogin')}
      </GoLink>
    </div>
  )
}
