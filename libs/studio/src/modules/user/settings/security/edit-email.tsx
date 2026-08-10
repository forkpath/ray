import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useTranslation } from '@libs/i18n'
import { Badge, Button, Form, FormControl, FormField, FormItem, FormMessage, Icons, Input } from '@libs/ui-web'

import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardDescription,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsCardTitle
} from '../../../../common/components/layout/settings-card'
import { pathsConfig } from '../../../../config/paths'
import { auth } from '../../../auth/lib/api'

interface EditEmailProps {
  readonly user: { email: string; emailVerified: boolean }
}

export const EditEmail = memo<EditEmailProps>(({ user: userData }) => {
  const { t } = useTranslation(['common', 'auth'])

  const form = useForm({
    defaultValues: {
      email: userData.email
    }
  })

  const sendVerification = useMutation({
    ...auth.mutations.email.sendVerification,
    onSuccess: () => {
      toast.success(
        t('auth:account.email.confirm.email.sent', {
          defaultValue: 'Verification email sent'
        })
      )
    }
  })

  const changeEmail = useMutation({
    ...auth.mutations.email.change,
    onSuccess: () => {
      toast.success(
        t('auth:account.email.change.success', {
          defaultValue: 'Email updated'
        })
      )
    }
  })

  const onSubmit = form.handleSubmit(data => {
    changeEmail.mutate({
      newEmail: data.email,
      callbackURL: pathsConfig.user.profile
    })
  })

  return (
    <SettingsCard>
      <SettingsCardHeader>
        <div className="flex items-center gap-3">
          <SettingsCardTitle>{t('common:email')}</SettingsCardTitle>
          <Badge variant={userData.emailVerified ? 'success' : 'destructive'}>
            {userData.emailVerified
              ? t('common:verified', { defaultValue: 'Verified' })
              : t('common:unverified', { defaultValue: 'Unverified' })}
          </Badge>
          {!userData.emailVerified && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                sendVerification.mutate({
                  email: userData.email,
                  callbackURL: pathsConfig.user.profile
                })
              }
              disabled={sendVerification.isPending}
              type="button"
              className="h-auto px-3 py-1 text-xs"
            >
              {sendVerification.isPending
                ? t('auth:account.email.confirm.loading', {
                    defaultValue: 'Sending...'
                  })
                : t('auth:account.email.confirm.cta', {
                    defaultValue: 'Resend verification'
                  })}
            </Button>
          )}
        </div>

        <SettingsCardDescription>
          {t('auth:account.email.change.description', {
            defaultValue: 'Change your email address.'
          })}
        </SettingsCardDescription>
      </SettingsCardHeader>

      <SettingsCardContent>
        <Form {...form}>
          <form id="user-edit-email-form" onSubmit={onSubmit}>
            <FormField
              control={form.control}
              name="email"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      inputMode="email"
                      spellCheck={false}
                      required
                      className="max-w-xs"
                      placeholder="john@doe.com"
                      disabled={form.formState.isSubmitting}
                      autoComplete="email"
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
        {t('auth:account.email.change.info', {
          defaultValue: 'A verification email will be sent to the new address.'
        })}
        <Button
          form="user-edit-email-form"
          type="submit"
          size="sm"
          disabled={form.formState.isSubmitting || changeEmail.isPending}
        >
          {changeEmail.isPending ? <Icons.Loader2 className="size-4 animate-spin" /> : t('common:save')}
        </Button>
      </SettingsCardFooter>
    </SettingsCard>
  )
})

EditEmail.displayName = 'EditEmail'
