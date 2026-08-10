import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { pathsConfig } from '~/config/paths'
import { Link } from '~/modules/common/styled'
import * as Linking from 'expo-linking'
import { Controller, useForm } from 'react-hook-form'
import { Alert, View } from 'react-native'

import { forgotPasswordSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button } from '@libs/ui-shared/mobile/components/button'
import { Field, FieldError, FieldLabel } from '@libs/ui-shared/mobile/components/field'
import { Icons } from '@libs/ui-shared/mobile/components/icons'
import { Input } from '@libs/ui-shared/mobile/components/input'
import { Spin } from '@libs/ui-shared/mobile/components/spin'
import { Text } from '@libs/ui-shared/mobile/components/text'

import { auth } from '../../lib/api'

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
