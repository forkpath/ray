import type { LoginOption } from './constants'

import { Suspense } from 'react'

import { AuthProvider } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@libs/ui-web'

import { GoLink } from '../../../../common/components/go-link'
import { pathsConfig } from '../../../../config/paths'
import { authClient } from '../../../../lib/auth/client'
import { MagicLinkLoginForm } from './magic-link'
import { PasswordLoginForm } from './password'

const LOGIN_OPTIONS_DETAILS = {
  [AuthProvider.PASSWORD]: {
    lastUsedMethodId: 'email',
    component: PasswordLoginForm,
    label: 'password'
  },
  [AuthProvider.MAGIC_LINK]: {
    lastUsedMethodId: AuthProvider.MAGIC_LINK,
    component: MagicLinkLoginForm,
    label: 'login.magicLink.label'
  }
} as const

interface LoginFormProps {
  readonly options: LoginOption[]
  readonly redirectTo?: string
  readonly email?: string
  readonly onTwoFactorRedirect?: () => void
}

export const LoginForm = ({ options, redirectTo, email, onTwoFactorRedirect }: LoginFormProps) => {
  const { t } = useTranslation(['auth', 'common'])
  const [mainOption] = options

  if (!options.length || !mainOption) {
    return null
  }

  if (options.length === 1) {
    const Component = LOGIN_OPTIONS_DETAILS[mainOption].component
    return <Component redirectTo={redirectTo} email={email} onTwoFactorRedirect={onTwoFactorRedirect} />
  }

  return (
    <Tabs defaultValue={mainOption} className="flex w-full flex-col items-center justify-center gap-2">
      <TabsList className="w-full">
        {options.map(provider => (
          <TabsTrigger key={provider} value={provider} className="relative w-full">
            {t(LOGIN_OPTIONS_DETAILS[provider].label)}

            {authClient.isLastUsedLoginMethod(LOGIN_OPTIONS_DETAILS[provider].lastUsedMethodId) && (
              <Badge className="absolute top-0 -right-4 z-10 -translate-y-1/2 shadow-sm">{t('lastUsed')}</Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>

      {options.map(provider => {
        const Component = LOGIN_OPTIONS_DETAILS[provider].component
        return (
          <TabsContent key={provider} value={provider} className="mt-4 w-full">
            <Suspense>
              <Component redirectTo={redirectTo} email={email} onTwoFactorRedirect={onTwoFactorRedirect} />
            </Suspense>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}

interface LoginCtaProps {
  readonly searchParams?: Record<string, string>
}

export const LoginCta = ({ searchParams }: LoginCtaProps) => {
  const { t } = useTranslation('auth')
  const searchString = searchParams ? new URLSearchParams(searchParams).toString() : ''

  return (
    <div className="flex items-center justify-center pt-2">
      <div className="text-muted-foreground text-sm">
        {t('register.alreadyHaveAccount')}
        <GoLink
          href={searchString ? `${pathsConfig.auth.login}?${searchString}` : pathsConfig.auth.login}
          className="hover:text-primary pl-2 font-medium underline underline-offset-4"
        >
          {t('login.cta')}!
        </GoLink>
      </div>
    </div>
  )
}
