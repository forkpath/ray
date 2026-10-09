'use client'

import type { RoutePath } from 'expo-router'

import { useMutation } from '@tanstack/react-query'

import { router } from 'expo-router'

import { useTranslation } from '@libs/i18n'
import { Button, Icons, Spin, Text } from '@libs/ui-native'

import { pathsConfig } from '~/config/paths'
import { auth } from '~/modules/auth/lib/api'

interface AnonymousLoginProps {
  readonly redirectTo?: RoutePath
}

export const AnonymousLogin = ({ redirectTo = pathsConfig.index }: AnonymousLoginProps) => {
  const { t } = useTranslation(['auth', 'common'])

  const signIn = useMutation({
    ...auth.mutations.signIn.anonymous,
    onSuccess: () => {
      router.navigate(redirectTo)
    }
  })

  return (
    <Button
      variant="outline"
      className="flex-row gap-2"
      size="lg"
      disabled={signIn.isPending}
      onPress={() => signIn.mutate(undefined)}
    >
      {signIn.isPending ? (
        <Spin>
          <Icons.Loader2 className="text-foreground size-5" />
        </Spin>
      ) : (
        <>
          <Icons.UserRound className="text-foreground" size={16} />
          <Text>{t('login.anonymous.cta')}</Text>
        </>
      )}
    </Button>
  )
}
