import type { LoginOption } from './form/login/constants'

import { memo, useState } from 'react'

import { AuthProvider, SecondFactor, SocialProvider } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'

import { AnonymousLogin } from './form/anonymous'
import { LOGIN_OPTIONS } from './form/login/constants'
import { LoginForm } from './form/login/form'
import { PasskeyLogin } from './form/login/passkey'
import { RegisterCta } from './form/register-form'
import { SocialProviders } from './form/social-providers'
import { TwoFactorCta, TwoFactorForm } from './form/two-factor'
import { AuthDivider } from './layout/divider'
import { AuthHeader } from './layout/header'
import { InvitationDisclaimer } from './layout/invitation-disclaimer'

const LoginStep = {
  FORM: 'form',
  TWO_FACTOR: 'twoFactor'
} as const

type LoginStepValue = (typeof LoginStep)[keyof typeof LoginStep]

interface LoginFlowProps {
  readonly redirectTo?: string
  readonly invitationId?: string
  readonly email?: string
}

export const LoginFlow = ({ redirectTo, invitationId, email }: LoginFlowProps) => {
  const [step, setStep] = useState<LoginStepValue>(LoginStep.FORM)

  switch (step) {
    case LoginStep.FORM:
      return (
        <Login
          redirectTo={redirectTo}
          invitationId={invitationId}
          email={email}
          onTwoFactorRedirect={() => setStep(LoginStep.TWO_FACTOR)}
        />
      )
    case LoginStep.TWO_FACTOR:
      return <TwoFactor redirectTo={redirectTo} />
  }
}

interface LoginProps extends LoginFlowProps {
  readonly onTwoFactorRedirect?: () => void
}

const Login = memo<LoginProps>(({ redirectTo, invitationId, email, onTwoFactorRedirect }) => {
  const { t } = useTranslation('auth')

  // All providers are enabled by default
  const oAuthProviders = [SocialProvider.GOOGLE, SocialProvider.GITHUB]
  const options = [AuthProvider.PASSWORD, AuthProvider.MAGIC_LINK].filter(opt =>
    LOGIN_OPTIONS.includes(opt as LoginOption)
  ) as LoginOption[]

  return (
    <>
      <AuthHeader title={t('login.header.title')} description={t('login.header.description')} />

      {invitationId && <InvitationDisclaimer />}

      <div className="flex flex-col gap-2">
        <SocialProviders providers={oAuthProviders} redirectTo={redirectTo} />
        <PasskeyLogin redirectTo={redirectTo} />
      </div>

      {oAuthProviders.length > 0 && options.length > 0 && <AuthDivider />}

      <div className="flex flex-col gap-2">
        <LoginForm options={options} redirectTo={redirectTo} email={email} onTwoFactorRedirect={onTwoFactorRedirect} />

        <AnonymousLogin />
      </div>

      <RegisterCta />
    </>
  )
})

Login.displayName = 'Login'

const TwoFactor = memo<LoginFlowProps>(({ redirectTo }) => {
  const [factor, setFactor] = useState<SecondFactor>(SecondFactor.TOTP)
  const { t } = useTranslation('auth')

  const Form = TwoFactorForm[factor]
  const Cta = factor === SecondFactor.TOTP ? TwoFactorCta[SecondFactor.BACKUP_CODE] : TwoFactorCta[SecondFactor.TOTP]

  return (
    <>
      <AuthHeader
        title={t(`login.twoFactor.${factor}.header.title`)}
        description={t(`login.twoFactor.${factor}.header.description`)}
      />

      <Form redirectTo={redirectTo} />
      <Cta onFactorChange={setFactor} />
    </>
  )
})

TwoFactor.displayName = 'TwoFactor'
