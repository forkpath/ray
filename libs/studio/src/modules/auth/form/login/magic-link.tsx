import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { AnimatePresence, motion } from 'motion/react'
import { useForm } from 'react-hook-form'

import { AuthProvider, generateName, magicLinkLoginSchema } from '@libs/auth-contract'
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
  Input
} from '@libs/ui-shared/web'

import { pathsConfig } from '../../../../config/paths'
import { auth } from '../../lib/api'
import { useAuthFormStore } from '../store'

interface MagicLinkLoginFormProps {
  readonly redirectTo?: string
  readonly email?: string
}

export const MagicLinkLoginForm = memo<MagicLinkLoginFormProps>(({ redirectTo = pathsConfig.user.profile, email }) => {
  const { t } = useTranslation(['common', 'auth'])
  const { provider, setProvider, isSubmitting, setIsSubmitting } = useAuthFormStore()

  const form = useForm({
    resolver: standardSchemaResolver(magicLinkLoginSchema),
    defaultValues: {
      email: email ?? ''
    }
  })

  const signIn = useMutation({
    ...auth.mutations.signIn.magicLink,
    onMutate: () => {
      setProvider(AuthProvider.MAGIC_LINK)
      setIsSubmitting(true)
    },
    onSettled: () => {
      setIsSubmitting(false)
    }
  })

  return (
    <AnimatePresence mode="wait">
      {form.formState.isSubmitSuccessful ? (
        <motion.div
          className="my-6 flex flex-col items-center justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          key="success"
        >
          <Icons.CheckCircle2 className="text-success h-20 w-20" strokeWidth={1.2} />
          <h2 className="text-center text-2xl font-semibold tracking-tight">{t('login.magicLink.success.title')}</h2>
          <p className="text-center">{t('login.magicLink.success.description')}</p>
        </motion.div>
      ) : (
        <Form {...form}>
          <form
            onSubmit={e => {
              e.preventDefault()
              void form.handleSubmit(data =>
                signIn.mutateAsync({
                  email: data.email,
                  name: generateName(data.email),
                  callbackURL: redirectTo,
                  errorCallbackURL: pathsConfig.auth.error
                })
              )(e)
            }}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('email')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      disabled={form.formState.isSubmitting}
                      autoComplete="email"
                      inputMode="email"
                      spellCheck={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && provider === AuthProvider.MAGIC_LINK ? (
                <Icons.Loader2 className="animate-spin" />
              ) : (
                t('login.magicLink.cta')
              )}
            </Button>
          </form>
        </Form>
      )}
    </AnimatePresence>
  )
})

MagicLinkLoginForm.displayName = 'MagicLinkLoginForm'
