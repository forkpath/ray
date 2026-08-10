import { SocialProvider } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'

import { AnonymousLogin } from './form/anonymous'
import { LoginCta } from './form/login/form'
import { RegisterForm } from './form/register-form'
import { SocialProviders } from './form/social-providers'
import { AuthDivider } from './layout/divider'
import { AuthHeader } from './layout/header'
import { InvitationDisclaimer } from './layout/invitation-disclaimer'

interface JoinPageProps {
  readonly redirectTo?: string
  readonly invitationId?: string
  readonly email?: string
}

export const JoinPage = ({ redirectTo, invitationId, email }: JoinPageProps) => {
  const { t } = useTranslation('auth')

  // All providers are enabled by default
  const oAuthProviders = [SocialProvider.GOOGLE, SocialProvider.GITHUB]

  return (
    <>
      <AuthHeader title={t('join.header.title')} description={t('join.header.description')} />
      {invitationId && <InvitationDisclaimer />}
      <SocialProviders providers={oAuthProviders} redirectTo={redirectTo} />
      {oAuthProviders.length > 0 && <AuthDivider />}
      <div className="flex flex-col gap-2">
        <RegisterForm redirectTo={redirectTo} email={email} />
        <AnonymousLogin />
      </div>
      <LoginCta />
    </>
  )
}
