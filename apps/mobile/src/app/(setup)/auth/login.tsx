import type { RoutePath } from 'expo-router'

import { useGlobalSearchParams } from 'expo-router'

import { LoginFlow } from '~/modules/auth/login'

const LoginPage = () => {
  const { redirectTo, invitationId, email } = useGlobalSearchParams<{
    redirectTo?: RoutePath
    invitationId?: string
    email?: string
  }>()

  return <LoginFlow redirectTo={redirectTo} invitationId={invitationId} email={email} />
}

export default LoginPage
