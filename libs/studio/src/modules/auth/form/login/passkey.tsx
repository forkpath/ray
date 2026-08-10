import { useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { AuthProvider } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Badge, Button, Icons } from '@libs/ui-web'

import { pathsConfig } from '../../../../config/paths'
import { authClient } from '../../../../lib/auth/client'
import { auth } from '../../lib/api'
import { useAuthFormStore } from '../store'

interface PasskeyLoginProps {
  readonly redirectTo?: string
}

export const PasskeyLogin = ({ redirectTo = pathsConfig.user.profile }: PasskeyLoginProps) => {
  const navigate = useNavigate()
  const { setProvider, setIsSubmitting, isSubmitting, provider } = useAuthFormStore()
  const { t } = useTranslation(['auth', 'common'])

  const queryClient = useQueryClient()
  const autoFillTriggered = useRef(false)

  const signIn = useMutation({
    ...auth.mutations.signIn.passkey,
    onMutate: () => {
      setProvider(AuthProvider.PASSKEY)
      setIsSubmitting(true)
    },
    onSettled: () => {
      setIsSubmitting(false)
    },
    onSuccess: () => {
      navigate({ to: redirectTo })
    }
  })

  // Passkey autoFill: 自动提示用户使用已保存的 passkey 登录
  // 使用 ref 防止 StrictMode 下重复执行
  useEffect(() => {
    if (autoFillTriggered.current) return
    autoFillTriggered.current = true

    void queryClient
      .getMutationCache()
      .build(queryClient, auth.mutations.signIn.passkey)
      .execute({ autoFill: true })
      .catch(() => {
        // 静默处理 autoFill 错误（用户取消、不支持等）
      })
  }, [queryClient])

  return (
    <Button
      variant="outline"
      className="relative gap-2"
      size="lg"
      onClick={() => signIn.mutate(undefined)}
      disabled={isSubmitting}
    >
      {isSubmitting && provider === AuthProvider.PASSKEY ? (
        <Icons.Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          <Icons.Key className="size-4" />
          {t('login.passkey.cta')}
        </>
      )}

      {authClient.isLastUsedLoginMethod(AuthProvider.PASSKEY) && (
        <Badge className="absolute top-0 -right-4 z-10 -translate-y-1/2 shadow-sm">{t('lastUsed')}</Badge>
      )}
    </Button>
  )
}
