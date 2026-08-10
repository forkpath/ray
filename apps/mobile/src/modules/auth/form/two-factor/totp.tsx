import type { CtaProps, FormProps } from '.'

import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { pathsConfig } from '~/config/paths'
import { router } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'

import { otpVerificationSchema, SecondFactor } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button } from '@libs/ui-shared/mobile/components/button'
import { Checkbox } from '@libs/ui-shared/mobile/components/checkbox'
import { Field, FieldError, FieldLabel } from '@libs/ui-shared/mobile/components/field'
import { Icons } from '@libs/ui-shared/mobile/components/icons'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@libs/ui-shared/mobile/components/input-otp'
import { Spin } from '@libs/ui-shared/mobile/components/spin'
import { Text } from '@libs/ui-shared/mobile/components/text'

import { auth } from '../../lib/api'

const TotpForm = memo<FormProps>(({ redirectTo = pathsConfig.index }) => {
  const { t } = useTranslation(['common', 'auth'])

  const form = useForm({
    resolver: standardSchemaResolver(otpVerificationSchema),
    defaultValues: {
      code: '',
      trustDevice: false
    }
  })

  const verifyTotp = useMutation({
    ...auth.mutations.twoFactor.totp.verify,
    onSuccess: () => {
      router.replace(redirectTo)
    }
  })

  return (
    <View className="flex flex-col items-start gap-6">
      <Controller
        control={form.control}
        name="code"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid} className="items-start">
            <InputOTP
              maxLength={6}
              autoFocus
              value={field.value}
              onChange={field.onChange}
              onComplete={() => form.handleSubmit(data => verifyTotp.mutateAsync(data))()}
              render={({ slots }) => (
                <InputOTPGroup>
                  {slots.map((slot, index) => (
                    <InputOTPSlot key={index} index={index} max={6} {...slot} />
                  ))}
                </InputOTPGroup>
              )}
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
        onPress={form.handleSubmit(data => verifyTotp.mutateAsync(data))}
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

const TotpCta = memo<CtaProps>(({ onFactorChange }) => {
  const { t } = useTranslation('auth')
  return (
    <View className="flex items-center justify-center pt-2">
      <Text
        onPress={() => onFactorChange(SecondFactor.TOTP)}
        className="text-muted-foreground font-sans-medium cursor-pointer pl-2 text-sm underline underline-offset-4"
      >
        {t('login.twoFactor.totp.cta')}
      </Text>
    </View>
  )
})

export { TotpForm, TotpCta }
