import { useMemo, useState } from 'react'

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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Icons,
  Input
} from '@libs/ui-web'

import { RequirePassword } from '../../require-password'
import { BackupCodesModal } from '../backup-codes/backup-codes'
import { useTwoFactor } from '../use-two-factor'
import { useTotp } from './use-totp'

interface TotpModalProps {
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
}

export const TotpModal = ({ open, onOpenChange }: TotpModalProps) => {
  const [backupCodesOpen, setBackupCodesOpen] = useState(false)
  const { t } = useTranslation(['common', 'auth'])

  const { uri, verify } = useTotp()
  const form = useForm({ defaultValues: { code: '' } })

  const onSubmit = async (data: { code: string }) => {
    try {
      await verify.mutateAsync({ code: data.code })
      onOpenChange?.(false)
      setBackupCodesOpen(true)
    } catch {
      setTimeout(() => form.setFocus('code'), 0)
    }
  }

  const secret = useMemo(() => {
    if (!uri) return null
    try {
      return new URL(uri).searchParams.get('secret')
    } catch {
      return null
    }
  }, [uri])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {t('auth:account.twoFactor.totp.enable.title', {
                defaultValue: 'Set up authenticator'
              })}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line">
              {t('auth:account.twoFactor.totp.enable.description', {
                defaultValue: 'Scan the QR code with your authenticator app, then enter the 6-digit code.'
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex w-full flex-col items-center gap-4">
            {uri && (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uri)}`}
                  alt="TOTP QR Code"
                  width={180}
                  height={180}
                  className="rounded-md"
                />
                {secret && <SecretDisplay secret={secret} />}
              </div>
            )}

            <Form {...form}>
              <form
                id="user-two-factor-totp-form"
                onSubmit={form.handleSubmit(onSubmit)}
                className="flex w-full flex-col items-center space-y-4"
              >
                <FormField
                  control={form.control}
                  name="code"
                  rules={{
                    required: true,
                    minLength: 6,
                    maxLength: 6
                  }}
                  render={({ field }) => (
                    <FormItem className="w-fit">
                      <FormLabel className="sr-only">{t('common:code', { defaultValue: 'Code' })}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          maxLength={6}
                          placeholder="000000"
                          className="w-40 text-center font-mono text-lg tracking-widest"
                          disabled={form.formState.isSubmitting}
                          autoComplete="one-time-code"
                          inputMode="numeric"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>

            <DialogFooter className="flex w-full justify-end">
              <Button variant="outline" type="button" onClick={() => onOpenChange?.(false)}>
                {t('common:close', { defaultValue: 'Close' })}
              </Button>
              <Button type="submit" form="user-two-factor-totp-form" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                  <Icons.Loader2 className="size-4 animate-spin" />
                ) : (
                  t('common:continue', { defaultValue: 'Continue' })
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <BackupCodesModal open={backupCodesOpen} onOpenChange={setBackupCodesOpen} />
    </>
  )
}

function SecretDisplay({ secret }: { secret: string }) {
  const [showCheck, setShowCheck] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(secret)
    setShowCheck(true)
    setTimeout(() => setShowCheck(false), 2000)
  }

  return (
    <span className="mb-1 inline-block w-full gap-2 px-6 text-center leading-none text-balance">
      <span className="font-mono text-sm leading-none text-balance break-all">{secret}</span>
      <Button variant="ghost" size="icon" className="ml-1 size-6" type="button" onClick={handleCopy}>
        {showCheck ? <Icons.Check className="size-3" /> : <Icons.Copy className="size-3" />}
      </Button>
    </span>
  )
}

export const TotpTile = () => {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation(['common', 'auth'])
  const { enabled } = useTwoFactor()
  const { setUri, getUri } = useTotp()

  const onEdit = async (data: { password: string }) => {
    const response = (await getUri.mutateAsync(data)) as unknown as {
      totpURI: string
    }
    setUri(response.totpURI)
    setOpen(true)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-md border p-4">
        <div>
          <span className="text-sm font-medium">
            {t('auth:account.twoFactor.totp.title', {
              defaultValue: 'Authenticator App'
            })}
          </span>
          <p className="text-muted-foreground text-sm">
            {t('auth:account.twoFactor.totp.description', {
              defaultValue: 'Use an authenticator app for 2FA codes.'
            })}
          </p>
        </div>

        <RequirePassword
          onConfirm={onEdit}
          render={
            <Button variant="outline" disabled={!enabled}>
              {enabled ? t('common:edit', { defaultValue: 'Edit' }) : t('common:add', { defaultValue: 'Add' })}
            </Button>
          }
        />
      </div>
      <TotpModal open={open} onOpenChange={setOpen} />
    </>
  )
}
