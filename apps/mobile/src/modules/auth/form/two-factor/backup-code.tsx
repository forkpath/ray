import type { CtaProps, FormProps } from '.'

import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { pathsConfig } from '~/config/paths'
import { router } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'

import { backupCodeVerificationSchema, SecondFactor } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button, Checkbox, Field, FieldError, FieldLabel, Icons, Input, Spin, Text } from '@libs/ui-native'

import { auth } from '../../lib/api'

const BackupCodeForm = memo<FormProps>(({ redirectTo = pathsConfig.index }) => {
  const { t } = useTranslation(['common', 'auth'])
  const form = useForm({
    resolver: standardSchemaResolver(backupCodeVerificationSchema),
    defaultValues: {
      code: '',
      trustDevice: false
    }
  })

  const verifyBackupCode = useMutation({
    ...auth.mutations.twoFactor.backupCodes.verify,
    onSuccess: () => {
      router.replace(redirectTo)
    }
  })

  return (
    <View className="flex flex-col gap-6">
      <Controller
        control={form.control}
        name="code"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid}>
            <Input
              {...field}
              onChangeText={field.onChange}
              autoFocus
              placeholder={t('login.twoFactor.backupCode.placeholder')}
              autoCapitalize="none"
              autoComplete="one-time-code"
              editable={!form.formState.isSubmitting}
            />
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />

      <Controller
        control={form.control}
        name="trustDevice"
        render={({ field }) => (
          <Field orientation="horizontal">
            <Checkbox {...field} checked={!!field.value} onCheckedChange={field.onChange} />
            <FieldLabel onPress={() => field.onChange(!field.value)}>{t('login.twoFactor.trustDevice')}</FieldLabel>
          </Field>
        )}
      />

      <Button
        className="w-full"
        size="lg"
        disabled={form.formState.isSubmitting}
        onPress={form.handleSubmit(data => verifyBackupCode.mutateAsync(data))}
      >
        {form.formState.isSubmitting ? (
          <Spin>
            <Icons.Loader2 className="text-primary-foreground" />
          </Spin>
        ) : (
          <Text>{t('verify')}</Text>
        )}
      </Button>
    </View>
  )
})

const BackupCodeCta = memo<CtaProps>(({ onFactorChange }) => {
  const { t } = useTranslation('auth')
  return (
    <View className="flex items-center justify-center pt-2">
      <Text
        onPress={() => onFactorChange(SecondFactor.BACKUP_CODE)}
        className="text-muted-foreground font-sans-medium cursor-pointer pl-2 text-sm underline underline-offset-4"
      >
        {t('login.twoFactor.backupCode.cta')}
      </Text>
    </View>
  )
})

export { BackupCodeForm, BackupCodeCta }
