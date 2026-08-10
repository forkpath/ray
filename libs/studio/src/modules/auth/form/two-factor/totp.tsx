import type { CtaProps, FormProps } from '.'

import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { useForm } from 'react-hook-form'

import { otpVerificationSchema, SecondFactor } from '@libs/auth-contract'
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
  Input
} from '@libs/ui-shared/web'

import { pathsConfig } from '../../../../config/paths'
import { auth } from '../../lib/api'

const TotpForm = memo<FormProps>(({ redirectTo = pathsConfig.user.profile }) => {
  const navigate = useNavigate()
  const { t } = useTranslation(['common', 'auth'])

  const form = useForm({
    resolver: standardSchemaResolver(otpVerificationSchema),
    defaultValues: {
      code: '',
      trustDevice: false
    }
  })

  const verifyTotp = useMutation({
    ...auth.mutations.twoFactor.totp.verify,
    onSuccess: () => {
      navigate({ to: redirectTo })
    }
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(data => verifyTotp.mutateAsync(data))} className="flex flex-col gap-6">
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('login.twoFactor.totp.codeLabel')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  disabled={form.formState.isSubmitting}
                  placeholder="000000"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="trustDevice"
          render={({ field }) => (
            <FormItem className="-mt-2 ml-px flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={form.formState.isSubmitting}
                />
              </FormControl>
              <FormLabel>{t('login.twoFactor.trustDevice')}</FormLabel>
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Icons.Loader2 className="animate-spin" /> : t('verify')}
        </Button>
      </form>
    </Form>
  )
})

const TotpCta = memo<CtaProps>(({ onFactorChange }) => {
  const { t } = useTranslation(['auth'])
  return (
    <div className="flex items-center justify-center pt-2">
      <span
        role="link"
        onClick={() => onFactorChange(SecondFactor.TOTP)}
        className="text-muted-foreground hover:text-primary cursor-pointer pl-2 text-sm font-medium underline underline-offset-4"
      >
        {t('login.twoFactor.totp.cta')}
      </span>
    </div>
  )
})

TotpForm.displayName = 'TotpForm'
TotpCta.displayName = 'TotpCta'

export { TotpForm, TotpCta }
