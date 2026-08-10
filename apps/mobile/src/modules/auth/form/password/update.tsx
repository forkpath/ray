'use client'

import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { pathsConfig } from '~/config/paths'
import { router } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'

import { updatePasswordSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button } from '@libs/ui-shared/mobile/components/button'
import { Field, FieldError, FieldLabel } from '@libs/ui-shared/mobile/components/field'
import { Icons } from '@libs/ui-shared/mobile/components/icons'
import { Input } from '@libs/ui-shared/mobile/components/input'
import { Spin } from '@libs/ui-shared/mobile/components/spin'
import { Text } from '@libs/ui-shared/mobile/components/text'

import { auth } from '../../lib/api'

interface UpdatePasswordFormProps {
  readonly token?: string
}

export const UpdatePasswordForm = memo<UpdatePasswordFormProps>(({ token }) => {
  const { t } = useTranslation(['common', 'auth'])

  const form = useForm({
    resolver: standardSchemaResolver(updatePasswordSchema),
    defaultValues: {
      password: ''
    }
  })

  const resetPassword = useMutation({
    ...auth.mutations.password.reset,
    onSuccess: () => {
      router.setParams({
        token: undefined
      })
      router.replace(pathsConfig.setup.auth.login)
    }
  })

  return (
    <View className="gap-6">
      <Controller
        name="password"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid}>
            <FieldLabel>{t('password')}</FieldLabel>
            <Input
              {...field}
              secureTextEntry
              autoComplete="new-password"
              onChangeText={field.onChange}
              editable={!form.formState.isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Button
        className="w-full"
        size="lg"
        onPress={form.handleSubmit(data =>
          resetPassword.mutateAsync({
            newPassword: data.password,
            token
          })
        )}
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <Spin>
            <Icons.Loader2 className="text-primary-foreground" />
          </Spin>
        ) : (
          <Text>{t('account.password.update.cta')}</Text>
        )}
      </Button>
    </View>
  )
})

UpdatePasswordForm.displayName = 'UpdatePasswordForm'
