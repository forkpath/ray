import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import * as Linking from 'expo-linking'
import { Controller, useForm } from 'react-hook-form'
import { Alert, View } from 'react-native'

import { forgotPasswordSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button, Field, FieldError, FieldLabel, Icons, Input, Spin, Text } from '@libs/ui-native'

import { pathsConfig } from '~/config/paths'
import { auth } from '~/modules/auth/lib/api'
import { Link } from '~/modules/common/styled'

export const ForgotPasswordForm = () => {
  const { t } = useTranslation(['common', 'auth'])

  const form = useForm({
    resolver: standardSchemaResolver(forgotPasswordSchema),
    defaultValues: {
      email: ''
    }
  })

  const forgetPassword = useMutation({
    ...auth.mutations.password.forget,
    onSuccess: () => {
      Alert.alert(t('account.password.forgot.success.title'), t('account.password.forgot.success.description'))
      form.reset()
    }
  })

  return (
    <View className="gap-6">
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid}>
            <FieldLabel>{t('common:email')}</FieldLabel>
            <Input
              {...field}
              onChangeText={field.onChange}
              autoCapitalize="none"
              testID="forgot-password-email"
              autoComplete="email"
              inputMode="email"
              keyboardType="email-address"
              spellCheck={false}
              maxLength={254}
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
          forgetPassword.mutateAsync({
            ...data,
            redirectTo: Linking.createURL(pathsConfig.setup.auth.updatePassword)
          })
        )}
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <Spin>
            <Icons.Loader2 className="text-primary-foreground size-5" />
          </Spin>
        ) : (
          <Text>{t('account.password.forgot.cta')}</Text>
        )}
      </Button>

      <View className="items-center justify-center pt-2">
        <Link
          replace
          href={pathsConfig.setup.auth.login}
          className="text-muted-foreground active:text-primary pl-2 font-sans text-sm underline"
        >
          {t('account.password.forgot.back')}
        </Link>
      </View>
    </View>
  )
}
