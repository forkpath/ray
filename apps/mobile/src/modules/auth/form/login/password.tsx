import type { RoutePath } from 'expo-router'

import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { router } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'

import { passwordLoginSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button, Checkbox, Field, FieldError, FieldLabel, Icons, Input, Spin, Text } from '@libs/ui-native'

import { pathsConfig } from '~/config/paths'
import { auth } from '~/modules/auth/lib/api'
import { Link } from '~/modules/common/styled'

interface PasswordLoginFormProps {
  readonly redirectTo?: RoutePath
  readonly email?: string
  readonly onTwoFactorRedirect?: () => void
}

export const PasswordLoginForm = memo<PasswordLoginFormProps>(
  ({ redirectTo = pathsConfig.index, email, onTwoFactorRedirect }) => {
    const { t } = useTranslation(['common', 'auth'])

    const form = useForm({
      resolver: standardSchemaResolver(passwordLoginSchema),
      defaultValues: {
        rememberMe: true,
        email
      }
    })

    const signIn = useMutation({
      ...auth.mutations.signIn.email,
      onSuccess: ctx => {
        if ('twoFactorRedirect' in ctx) {
          console.log('twoFactorRedirect')
          return onTwoFactorRedirect?.()
        }
        console.log('redirectTo', redirectTo)
        router.navigate(redirectTo)
      }
    })

    return (
      <View className="gap-6">
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('common:email')}</FieldLabel>
              <Input
                {...field}
                onChangeText={field.onChange}
                autoCapitalize="none"
                testID="login-email"
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

        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <View className="flex-row items-center justify-between">
                <FieldLabel>{t('password')}</FieldLabel>
                <Link
                  testID="login-forgot-password"
                  href={pathsConfig.setup.auth.forgotPassword}
                  className="text-muted-foreground self-end font-sans text-sm underline underline-offset-4"
                >
                  {t('account.password.forgot.label')}
                </Link>
              </View>
              <Input
                {...field}
                secureTextEntry
                autoComplete="password"
                onChangeText={field.onChange}
                editable={!form.formState.isSubmitting}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          name="rememberMe"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid} orientation="horizontal">
              <Checkbox
                {...field}
                checked={!!field.value}
                onCheckedChange={field.onChange}
                disabled={form.formState.isSubmitting}
              />
              <FieldLabel onPress={() => field.onChange(!field.value)}>{t('rememberMe')}</FieldLabel>
            </Field>
          )}
        />

        <Button
          className="w-full"
          size="lg"
          onPress={form.handleSubmit(data => signIn.mutateAsync(data))}
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <Spin>
              <Icons.Loader2 className="text-primary-foreground" />
            </Spin>
          ) : (
            <Text>{t('login.cta')}</Text>
          )}
        </Button>
      </View>
    )
  }
)

PasswordLoginForm.displayName = 'PasswordLoginForm'
