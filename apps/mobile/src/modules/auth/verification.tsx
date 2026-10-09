import type { RoutePath } from 'expo-router'

import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'

import { router, useGlobalSearchParams } from 'expo-router'

import { VerificationType } from '@libs/auth-contract'

import { useSetupSteps } from '~/app/(setup)/steps/_layout'
import { pathsConfig } from '~/config/paths'
import { Spinner } from '~/modules/common/spinner'
import { user } from '~/modules/user/lib/api'

import { auth } from './lib/api'

const useVerificationMutations = ({ onSuccess, onError }: { onSuccess?: () => void; onError?: () => void }) => {
  const { reset } = useSetupSteps()
  const signOut = useMutation({
    ...auth.mutations.signOut,
    onSuccess: () => {
      reset()
    }
  })

  return {
    [VerificationType.MAGIC_LINK]: useMutation({
      ...auth.mutations.magicLink.verify,
      onSuccess,
      onError
    }),
    [VerificationType.CONFIRM_EMAIL]: useMutation({
      ...auth.mutations.email.verify,
      onSuccess,
      onError
    }),
    [VerificationType.DELETE_ACCOUNT]: useMutation({
      ...user.mutations.delete.user,
      onSuccess: async () => {
        await signOut.mutateAsync(undefined)
        onSuccess?.()
      },
      onError
    })
  }
}

const VerificationController = ({
  token,
  type,
  callbackURL,
  redirectTo,
  errorCallbackURL
}: {
  token: string
  type: VerificationType
  callbackURL?: RoutePath
  redirectTo?: RoutePath
  errorCallbackURL?: RoutePath
}) => {
  const resetParams = () => {
    router.setParams({
      token: undefined,
      type: undefined,
      redirectTo: undefined,
      callbackURL: undefined,
      errorCallbackURL: undefined
    })
  }

  const mutations = useVerificationMutations({
    onSuccess: () => {
      router.navigate(redirectTo ?? callbackURL ?? pathsConfig.index)
      resetParams()
    },
    ...(errorCallbackURL
      ? {
          onError: () => {
            router.navigate(errorCallbackURL)
            resetParams()
          }
        }
      : {})
  })

  const { mutate, isPending } = mutations[type]

  useEffect(() => {
    if (token && !isPending) {
      mutate({
        token
      })
    }
  }, [token, isPending, mutate, callbackURL, errorCallbackURL])

  if (isPending) {
    return <Spinner />
  }

  return null
}

export const Verification = () => {
  const {
    token,
    type,
    callbackURL = pathsConfig.index,
    redirectTo,
    errorCallbackURL
  } = useGlobalSearchParams<{
    token?: string
    type?: VerificationType
    callbackURL?: RoutePath
    redirectTo?: RoutePath
    errorCallbackURL?: RoutePath
  }>()

  if (!token || !type) {
    return null
  }

  return (
    <VerificationController
      token={token}
      type={type}
      callbackURL={callbackURL}
      redirectTo={redirectTo}
      errorCallbackURL={errorCallbackURL}
    />
  )
}
