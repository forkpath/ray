import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { authClient } from '~/lib/auth'
import { user } from '~/modules/user/lib/api'
import { router } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'

import { updateUserSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button } from '@libs/ui-shared/mobile/components/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@libs/ui-shared/mobile/components/field'
import { Icons } from '@libs/ui-shared/mobile/components/icons'
import { Input } from '@libs/ui-shared/mobile/components/input'
import { Spin } from '@libs/ui-shared/mobile/components/spin'
import { Text } from '@libs/ui-shared/mobile/components/text'

const EditName = () => {
  const { t } = useTranslation(['common', 'auth'])
  const session = authClient.useSession()

  const form = useForm({
    resolver: standardSchemaResolver(updateUserSchema.pick({ name: true })),
    defaultValues: {
      name: session.data?.user.name ?? ''
    }
  })

  const updateUser = useMutation({
    ...user.mutations.update,
    onSuccess: () => {
      router.back()
    }
  })

  return (
    <View className="bg-background flex-1 p-6">
      <View className="flex-1 gap-6">
        <Text className="text-muted-foreground font-sans-medium text-base">{t('account.name.edit.description')}</Text>

        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('name')}</FieldLabel>
              <Input
                {...field}
                autoCapitalize="words"
                autoComplete="name"
                onChangeText={field.onChange}
                editable={!form.formState.isSubmitting}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              <FieldDescription>{t('account.name.edit.info')}</FieldDescription>
            </Field>
          )}
        />

        <Button
          className="w-full"
          size="lg"
          onPress={form.handleSubmit(data => updateUser.mutateAsync(data))}
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? (
            <Spin>
              <Icons.Loader2 className="text-primary-foreground" />
            </Spin>
          ) : (
            <Text>{t('save')}</Text>
          )}
        </Button>
      </View>
    </View>
  )
}

export default EditName
