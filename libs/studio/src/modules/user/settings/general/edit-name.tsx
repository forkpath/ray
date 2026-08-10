import { memo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { updateUserSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import { Button, Form, FormControl, FormField, FormItem, FormMessage, Icons, Input } from '@libs/ui-web'

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardDescription,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsCardTitle
} from '../../../../common/components/layout/settings-card'
import { user } from '../../lib/api'

const nameSchema = updateUserSchema.pick({ name: true })

interface EditNameProps {
  readonly user: { name: string | null }
}

export const EditName = memo<EditNameProps>(({ user: userData }) => {
  const { t } = useTranslation(['common', 'auth'])
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: standardSchemaResolver(nameSchema),
    defaultValues: {
      name: userData.name ?? ''
    }
  })

  const updateUser = useMutation({
    ...user.mutations.update,
    onSuccess: () => {
      toast.success(t('auth:account.name.edit.success', { defaultValue: 'Name updated' }))
      void queryClient.invalidateQueries({ queryKey: ['auth'] })
    }
  })

  const onSubmit = form.handleSubmit(data => {
    updateUser.mutate({ name: data.name })
  })

  return (
    <SettingsCard>
      <SettingsCardHeader>
        <SettingsCardTitle>{t('common:name')}</SettingsCardTitle>
        <SettingsCardDescription>
          {t('auth:account.name.edit.description', { defaultValue: 'Your display name visible to others.' })}
        </SettingsCardDescription>
      </SettingsCardHeader>

      <SettingsCardContent>
        <Form {...form}>
          <form id="user-edit-name-form" onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="name"
                      spellCheck={false}
                      required
                      minLength={2}
                      maxLength={32}
                      className="max-w-xs"
                      disabled={form.formState.isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </SettingsCardContent>

      <SettingsCardFooter>
        {t('auth:account.name.edit.info', { defaultValue: 'Please use 2-32 characters.' })}
        <Button
          form="user-edit-name-form"
          type="submit"
          size="sm"
          disabled={form.formState.isSubmitting || updateUser.isPending}
        >
          {updateUser.isPending ? <Icons.Loader2 className="size-4 animate-spin" /> : t('common:save')}
        </Button>
      </SettingsCardFooter>
    </SettingsCard>
  )
})

EditName.displayName = 'EditName'
