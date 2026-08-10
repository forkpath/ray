import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { authClient } from '~/lib/auth'
import { organization } from '~/modules/organization/lib/api'
import { router } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'

import { toMemberRole, updateOrganizationSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button, Field, FieldDescription, FieldError, FieldLabel, Icons, Input, Spin, Text } from '@libs/ui-native'

const EditName = () => {
  const { t } = useTranslation(['common', 'organization'])
  const { data: activeOrganization, refetch } = authClient.useActiveOrganization()
  const { data: activeMember } = authClient.useActiveMember()

  const form = useForm({
    resolver: standardSchemaResolver(updateOrganizationSchema.pick({ name: true })),
    defaultValues: {
      name: activeOrganization?.name
    }
  })

  const hasUpdatePermission = authClient.organization.checkRolePermission({
    permissions: {
      organization: ['update']
    },
    role: toMemberRole(activeMember?.role)
  })

  const updateOrganization = useMutation({
    ...organization.mutations.update,
    onSuccess: async () => {
      await refetch()
      router.back()
    }
  })

  if (!activeOrganization || !hasUpdatePermission) {
    return null
  }

  return (
    <View className="bg-background flex-1 p-6">
      <View className="flex-1 gap-6">
        <Text className="text-muted-foreground font-sans-medium">{t('name.edit.description')}</Text>

        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('common:name')}</FieldLabel>
              <Input
                {...field}
                autoCapitalize="words"
                autoComplete="name"
                onChangeText={field.onChange}
                editable={!form.formState.isSubmitting}
                value={field.value ?? ''}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              <FieldDescription>{t('name.edit.info')}</FieldDescription>
            </Field>
          )}
        />

        <Button
          className="w-full"
          size="lg"
          onPress={form.handleSubmit(data =>
            updateOrganization.mutateAsync({
              data,
              organizationId: activeOrganization.id
            })
          )}
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
