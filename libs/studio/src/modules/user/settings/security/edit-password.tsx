import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useTranslation } from '@libs/i18n'
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Icons,
  PasswordInput,
  Skeleton
} from '@libs/ui-web'

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardDescription,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsCardTitle
} from '../../../../common/components/layout/settings-card'
import { pathsConfig } from '../../../../config/paths'
import { authClient } from '../../../../lib/auth/client'
import { auth } from '../../../auth/lib/api'

export const EditPassword = () => {
  const { t } = useTranslation(['common', 'auth'])
  const session = authClient.useSession()

  const { data: accounts, isLoading } = useQuery({
    ...auth.queries.accounts.getAll,
    enabled: !!(session as unknown as { data?: { user?: { id: string } } }).data?.user?.id
  })

  const form = useForm({
    defaultValues: {
      password: '',
      newPassword: ''
    }
  })

  const changePassword = useMutation({
    ...auth.mutations.password.change,
    onSuccess: () => {
      toast.success(
        t('auth:account.password.update.success', {
          defaultValue: 'Password updated'
        })
      )
      form.reset()
    }
  })

  const accountList = (accounts as unknown as { providerId: string }[]) ?? []
  const hasPassword = accountList.some(a => a.providerId === 'credential')

  const onSubmit = form.handleSubmit(data => {
    changePassword.mutate({
      currentPassword: data.password,
      newPassword: data.newPassword,
      revokeOtherSessions: true
    })
  })

  return (
    <SettingsCard>
      <SettingsCardHeader>
        <SettingsCardTitle>{t('common:password')}</SettingsCardTitle>
        <SettingsCardDescription>
          {t('auth:account.password.update.description', {
            defaultValue: 'Update your password.'
          })}
        </SettingsCardDescription>
      </SettingsCardHeader>

      <SettingsCardContent>
        {isLoading && <Skeleton className="mt-0 h-20" />}

        {!isLoading &&
          (hasPassword ? (
            <Form {...form}>
              <form id="user-edit-password-form" onSubmit={onSubmit} className="flex w-full flex-wrap gap-3 lg:gap-5">
                <FormField
                  control={form.control}
                  name="password"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <FormItem className="w-full max-w-xs gap-1">
                      <FormLabel>
                        {t('common:currentPassword', {
                          defaultValue: 'Current Password'
                        })}
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          {...field}
                          autoComplete="current-password"
                          required
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  rules={{ required: true, minLength: 8 }}
                  render={({ field }) => (
                    <FormItem className="w-full max-w-xs gap-1">
                      <FormLabel>
                        {t('common:newPassword', {
                          defaultValue: 'New Password'
                        })}
                      </FormLabel>
                      <FormControl>
                        <PasswordInput
                          {...field}
                          autoComplete="new-password"
                          required
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          ) : (
            <div className="flex w-full items-center justify-center rounded-md border border-dashed p-6">
              <p className="text-center text-sm">
                {t('auth:account.password.update.noPassword', {
                  defaultValue: 'No password set. You can set one via the'
                })}{' '}
                <Link
                  to={pathsConfig.auth.forgotPassword}
                  className="hover:text-primary font-medium underline underline-offset-4"
                >
                  {t('auth:forgotPassword', {
                    defaultValue: 'forgot password'
                  })}
                </Link>{' '}
                {t('common:page', { defaultValue: 'page' })}.
              </p>
            </div>
          ))}
      </SettingsCardContent>

      <SettingsCardFooter>
        {t('auth:account.password.update.info', {
          defaultValue: 'Password must be at least 8 characters.'
        })}

        {!isLoading && hasPassword && (
          <Button
            form="user-edit-password-form"
            type="submit"
            size="sm"
            disabled={form.formState.isSubmitting || changePassword.isPending}
          >
            {changePassword.isPending ? <Icons.Loader2 className="size-4 animate-spin" /> : t('common:save')}
          </Button>
        )}
      </SettingsCardFooter>
    </SettingsCard>
  )
}
