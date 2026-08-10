import { memo } from 'react'
import { useMutation } from '@tanstack/react-query'

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { AnimatePresence, motion } from 'motion/react'
import { useForm } from 'react-hook-form'

import { AuthProvider, generateName, registerSchema } from '@libs/auth-contract'
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
  Input,
  PasswordInput
} from '@libs/ui-web'

import { GoLink } from '../../../common/components/go-link'
import { pathsConfig } from '../../../config/paths'
import { auth } from '../lib/api'
import { useAuthFormStore } from './store'

interface RegisterFormProps {
  readonly redirectTo?: string
  readonly email?: string
}

export const RegisterForm = memo<RegisterFormProps>(({ redirectTo = pathsConfig.user.profile, email }) => {
  const { t } = useTranslation(['common', 'auth'])
  const { provider, setProvider, isSubmitting, setIsSubmitting } = useAuthFormStore()

  const form = useForm({
    resolver: standardSchemaResolver(registerSchema),
    defaultValues: {
      email
    }
  })

  const signUp = useMutation({
    ...auth.mutations.signUp.email,
    onMutate: () => {
      setProvider(AuthProvider.PASSWORD)
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
          <h2 className="text-center text-2xl font-semibold tracking-tight">{t('register.success.title')}</h2>
          <p className="text-center">{t('register.success.description')}</p>
        </motion.div>
      ) : (
        <Form {...form} key="idle">
          <motion.form
            onSubmit={e => {
              e.preventDefault()
              void form.handleSubmit(data =>
                signUp.mutateAsync({
                  ...data,
                  name: generateName(data.email),
                  callbackURL: redirectTo
                })
              )(e)
            }}
            className="space-y-6"
            exit={{ opacity: 0 }}
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
                      disabled={isSubmitting}
                      autoComplete="email"
                      inputMode="email"
                      spellCheck={false}
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
                  <FormLabel>{t('password')}</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} disabled={isSubmitting} autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && provider === AuthProvider.PASSWORD ? (
                <Icons.Loader2 className="animate-spin" />
              ) : (
                t('register.cta')
              )}
            </Button>
          </motion.form>
        </Form>
      )}
    </AnimatePresence>
  )
})

RegisterForm.displayName = 'RegisterForm'

interface RegisterCtaProps {
  readonly searchParams?: Record<string, string>
}

export const RegisterCta = ({ searchParams }: RegisterCtaProps) => {
  const { t } = useTranslation('auth')
  const searchString = searchParams ? new URLSearchParams(searchParams).toString() : ''

  return (
    <div className="flex items-center justify-center pt-2">
      <div className="text-muted-foreground text-sm">
        {t('login.noAccount')}
        <GoLink
          href={searchString ? `${pathsConfig.auth.register}?${searchString}` : pathsConfig.auth.register}
          className="hover:text-primary pl-2 font-medium underline underline-offset-4"
        >
          {t('register.cta')}!
        </GoLink>
      </div>
    </div>
  )
}
