import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useForm } from 'react-hook-form'

import { AuthProvider, passwordLoginSchema } from '@libs/auth-contract'
import { useTranslation } from '@libs/i18n'
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Icons,
  Input,
  PasswordInput
} from '@libs/ui-web'

import { GoLink } from '../../../../common/components/go-link'
import { pathsConfig } from '../../../../config/paths'
import { auth } from '../../lib/api'
import { useAuthFormStore } from '../store'

interface PasswordLoginFormProps {
  readonly redirectTo?: string
  readonly email?: string
  readonly onTwoFactorRedirect?: () => void
}

export const PasswordLoginForm = memo<PasswordLoginFormProps>(
  ({ redirectTo = pathsConfig.user.profile, email, onTwoFactorRedirect }) => {
    const { t } = useTranslation(['common', 'auth'])
    const { provider, setProvider, isSubmitting, setIsSubmitting } = useAuthFormStore()

    const form = useForm({
      resolver: standardSchemaResolver(passwordLoginSchema),
      defaultValues: {
        rememberMe: true,
        email
      }
    })

    const signIn = useMutation({
      ...auth.mutations.signIn.email,
      onMutate: () => {
        setProvider(AuthProvider.PASSWORD)
        setIsSubmitting(true)
      },
      onSettled: () => {
        setIsSubmitting(false)
      },
      onSuccess: ctx => {
        if ('twoFactorRedirect' in ctx) {
          return onTwoFactorRedirect?.()
        }
        window.location.href = redirectTo
      }
    })

    return (
      <Form {...form}>
        <form
          onSubmit={e => {
            e.preventDefault()
            void form.handleSubmit(data =>
              signIn.mutateAsync({
                ...data,
                callbackURL: redirectTo
              })
            )(e)
          }}
          className="flex flex-col gap-6"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('common:email')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    disabled={isSubmitting}
                    autoComplete="email webauthn"
                    inputMode="email"
                    spellCheck={false}
                    maxLength={254}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-col-reverse gap-2">
                  <FormControl>
                    <PasswordInput {...field} disabled={isSubmitting} autoComplete="current-password webauthn" />
                  </FormControl>
                  <div className="flex w-full items-center justify-between">
                    <FormLabel>{t('password')}</FormLabel>
                    <GoLink
                      href={pathsConfig.auth.forgotPassword}
                      className="text-muted-foreground hover:text-primary text-sm underline underline-offset-4"
                    >
                      {t('account.password.forgot.label')}
                    </GoLink>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <FormItem className="-mt-2 ml-px flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                </FormControl>
                <FormLabel>{t('rememberMe')}</FormLabel>
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting && provider === AuthProvider.PASSWORD ? (
              <Icons.Loader2 className="animate-spin" />
            ) : (
              t('login.cta')
            )}
          </Button>
        </form>
      </Form>
    )
  }
)

PasswordLoginForm.displayName = 'PasswordLoginForm'
