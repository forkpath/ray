import { memo, useState } from 'react'

import { useForm } from 'react-hook-form'

import { useTranslation } from '@libs/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Icons,
  PasswordInput
} from '@libs/ui-web'

interface RequirePasswordProps {
  readonly title?: string
  readonly description?: string
  readonly cta?: string
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  readonly onConfirm: (data: { password: string }) => Promise<void>
  readonly render: React.ReactElement
  readonly nativeButton?: boolean
}

export const RequirePassword = memo<RequirePasswordProps>(
  ({ title, description, onConfirm, cta, render, open: _open, onOpenChange: _onOpenChange }) => {
    const { t } = useTranslation(['common', 'auth'])
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
    const controlled = _open !== undefined
    const open = controlled ? _open : uncontrolledOpen

    const form = useForm({
      defaultValues: { password: '' }
    })

    const onOpenChange = (nextOpen: boolean) => {
      if (!controlled) setUncontrolledOpen(nextOpen)
      _onOpenChange?.(nextOpen)
    }

    const onSubmit = async (data: { password: string }) => {
      try {
        await onConfirm(data)
        form.reset()
        onOpenChange(false)
      } catch {
        setTimeout(() => form.setFocus('password'), 0)
      }
    }

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{render}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {title ??
                t('auth:account.password.require.title', {
                  defaultValue: 'Enter your password'
                })}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {description ??
                t('auth:account.password.require.description', {
                  defaultValue: 'Please enter your password to continue.'
                })}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form id="require-password-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                rules={{ required: true }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common:password')}</FormLabel>
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
            </form>
          </Form>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              {t('common:cancel')}
            </Button>
            <Button type="submit" form="require-password-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Icons.Loader2 className="size-4 animate-spin" />
              ) : (
                (cta ?? t('common:continue', { defaultValue: 'Continue' }))
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
)

RequirePassword.displayName = 'RequirePassword'
