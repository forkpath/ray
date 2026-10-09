import type { CreateOrganizationPayload } from '@libs/auth-contract'
import type { BottomSheetContentRef } from '@libs/ui-native'

import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { router } from 'expo-router'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'

import { createOrganizationSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import {
  BottomSheet,
  BottomSheetCloseTrigger,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetOpenTrigger,
  BottomSheetScrollView,
  BottomSheetTitle,
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Icons,
  Input,
  Spin,
  Text,
  useBottomSheet
} from '@libs/ui-native'

import { pathsConfig } from '~/config/paths'
import { authClient } from '~/lib/auth'

import { organization } from './lib/api'

export const CreateOrganizationBottomSheet = ({
  children,
  ref
}: {
  children?: React.ReactNode
  ref?: React.RefObject<BottomSheetContentRef | null>
}) => {
  const { t } = useTranslation(['common', 'organization'])
  const sheet = useBottomSheet()

  const activeOrganization = authClient.useActiveOrganization()
  const activeMember = authClient.useActiveMember()

  const form = useForm({
    resolver: standardSchemaResolver(createOrganizationSchema),
    defaultValues: {
      name: ''
    }
  })

  const getSlug = useMutation(organization.mutations.getSlug)
  const setActive = useMutation({
    ...organization.mutations.setActive,
    onSuccess: async () => {
      await activeOrganization.refetch()
      await activeMember.refetch()
    }
  })
  const create = useMutation(organization.mutations.create)

  const onSubmit = async (data: CreateOrganizationPayload) => {
    const { slug } = await getSlug.mutateAsync(data)

    const organization = await create.mutateAsync({
      ...data,
      slug
    })

    await setActive.mutateAsync({ organizationId: organization.id })

    ref?.current?.dismiss()
    sheet.close()
    router.replace(pathsConfig.dashboard.organization.index)
  }

  return (
    <BottomSheet>
      {children && <BottomSheetOpenTrigger asChild>{children}</BottomSheetOpenTrigger>}
      <BottomSheetContent ref={ref ?? sheet.ref} name="create-organization">
        <BottomSheetScrollView>
          <BottomSheetHeader>
            <BottomSheetTitle>{t('create.title')}</BottomSheetTitle>
            <BottomSheetDescription>{t('create.description')}</BottomSheetDescription>
          </BottomSheetHeader>

          <Controller
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <Field invalid={fieldState.invalid}>
                <FieldLabel>{t('common:name')}</FieldLabel>
                <Input {...field} autoFocus onChangeText={field.onChange} editable={!form.formState.isSubmitting} />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                <FieldDescription>{t('create.info')}</FieldDescription>
              </Field>
            )}
          />

          <View className="gap-2">
            <BottomSheetCloseTrigger asChild>
              <Button variant="outline">
                <Text>{t('cancel')}</Text>
              </Button>
            </BottomSheetCloseTrigger>
            <Button onPress={form.handleSubmit(onSubmit)} disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Spin>
                  <Icons.Loader2 className="text-primary-foreground" size={16} />
                </Spin>
              ) : (
                <Text>{t('create.cta')}</Text>
              )}
            </Button>
          </View>
        </BottomSheetScrollView>
      </BottomSheetContent>
    </BottomSheet>
  )
}
