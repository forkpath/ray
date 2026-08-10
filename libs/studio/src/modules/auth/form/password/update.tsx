import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { motion } from 'motion/react'
import { useForm } from 'react-hook-form'

import { updatePasswordSchema } from '@libs/auth-contract'
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
  PasswordInput
} from '@libs/ui-web'

import { pathsConfig } from '../../../../config/paths'
import { auth } from '../../lib/api'

interface UpdatePasswordFormProps {
  readonly token?: string
}

export const UpdatePasswordForm = memo<UpdatePasswordFormProps>(({ token }) => {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const form = useForm({
    resolver: standardSchemaResolver(updatePasswordSchema)
  })

  const resetPassword = useMutation({
    ...auth.mutations.password.reset,
    onSuccess: () => {
      void navigate({
        to: pathsConfig.auth.login,
        search: {
          redirectTo: undefined,
          invitationId: undefined,
          email: undefined
        }
      })
    }
  })

  return (
    <Form {...form} key="idle">
      <motion.form
        onSubmit={e => {
          e.preventDefault()
          void form.handleSubmit(data =>
            resetPassword.mutateAsync({
              newPassword: data.password,
              token
            })
          )(e)
        }}
        className="space-y-6"
        exit={{ opacity: 0 }}
      >
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <PasswordInput {...field} disabled={form.formState.isSubmitting} autoComplete="new-password" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Icons.Loader2 className="animate-spin" /> : t('account.password.update.cta')}
        </Button>
      </motion.form>
    </Form>
  )
})

UpdatePasswordForm.displayName = 'UpdatePasswordForm'
