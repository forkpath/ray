import type { Route } from 'expo-router'

import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { pathsConfig } from '~/config/paths'
import { Controller, useForm } from 'react-hook-form'
import { Alert, View } from 'react-native'

import { generateName, magicLinkLoginSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button } from '@libs/ui-shared/mobile/components/button'
import { Field, FieldError, FieldLabel } from '@libs/ui-shared/mobile/components/field'
import { Icons } from '@libs/ui-shared/mobile/components/icons'
import { Input } from '@libs/ui-shared/mobile/components/input'
import { Spin } from '@libs/ui-shared/mobile/components/spin'
import { Text } from '@libs/ui-shared/mobile/components/text'

import { auth } from '../../lib/api'

interface MagicLinkLoginFormProps {
  readonly redirectTo?: Route
  readonly email?: string
}

export const MagicLinkLoginForm = memo<MagicLinkLoginFormProps>(({ redirectTo = pathsConfig.index, email }) => {
  const { t } = useTranslation(['common', 'auth'])
  const form = useForm({
    resolver: standardSchemaResolver(magicLinkLoginSchema),
    defaultValues: {
      email: email ?? ''
    }
  })

  const signIn = useMutation({
    ...auth.mutations.signIn.magicLink,
    onSuccess: () => {
      Alert.alert(t('login.magicLink.success.title'), t('login.magicLink.success.description'))
      form.reset()
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
          signIn.mutateAsync({
            ...data,
            name: generateName(data.email),
            callbackURL: redirectTo
          })
        )}
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <Spin>
            <Icons.Loader2 className="text-primary-foreground size-5" />
          </Spin>
        ) : (
          <Text>{t('login.magicLink.cta')}</Text>
        )}
      </Button>
    </View>
  )
})
