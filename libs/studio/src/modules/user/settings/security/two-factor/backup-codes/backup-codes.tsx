import { useCallback, useState } from 'react'

import { useTranslation } from '@libs/i18n'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Icons
} from '@libs/ui-web'

import { RequirePassword } from '../../require-password'
import { useTwoFactor } from '../use-two-factor'
import { useBackupCodes } from './use-backup-codes'

interface BackupCodesModalProps {
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
}

export const BackupCodesModal = ({ open, onOpenChange: _onOpenChange }: BackupCodesModalProps) => {
  const { t } = useTranslation(['common', 'auth'])
  const { codes, setCodes } = useBackupCodes()

  const onOpenChange = useCallback(
    (nextOpen: boolean) => {
      _onOpenChange?.(nextOpen)
      if (!nextOpen) setCodes([])
    },
    [_onOpenChange, setCodes]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {t('auth:account.twoFactor.backupCodes.save.title', {
              defaultValue: 'Save your backup codes'
            })}
          </DialogTitle>
          <DialogDescription>
            {t('auth:account.twoFactor.backupCodes.save.description', {
              defaultValue:
                'Keep these codes in a safe place. You can use them to sign in if you lose access to your authenticator.'
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex w-full flex-col items-center gap-4">
          <div className="w-full overflow-hidden rounded-md border">
            <div className="bg-muted/25 grid grid-cols-2 gap-2 border-b py-1">
              {codes.map(code => (
                <code key={code} className="rounded p-1.5 text-center font-mono text-sm">
                  {code}
                </code>
              ))}
            </div>
            <div className="flex justify-end p-2">
              <DownloadButton codes={codes} />
              <CopyButton codes={codes} />
            </div>
          </div>

          <DialogFooter className="flex w-full justify-end gap-2">
            <Button onClick={() => onOpenChange(false)}>{t('common:continue', { defaultValue: 'Continue' })}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CopyButton({ codes }: { codes: string[] }) {
  const { t } = useTranslation('common')
  const [showCheck, setShowCheck] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes.join('\n'))
    setShowCheck(true)
    setTimeout(() => setShowCheck(false), 2000)
  }

  return (
    <Button variant="ghost" className="h-auto gap-1.5 px-3 py-1.5" onClick={handleCopy}>
      {showCheck ? <Icons.Check className="size-4" /> : <Icons.Copy className="size-4" />}
      {t('copy', { defaultValue: 'Copy' })}
    </Button>
  )
}

function DownloadButton({ codes }: { codes: string[] }) {
  const { t } = useTranslation('common')

  const handleDownload = () => {
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="ghost" className="h-auto gap-1.5 px-3 py-1.5" onClick={handleDownload}>
      <Icons.Download className="size-4" />
      {t('download', { defaultValue: 'Download' })}
    </Button>
  )
}

export const BackupCodesTile = () => {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation(['common', 'auth'])
  const { enabled } = useTwoFactor()
  const { generate } = useBackupCodes()

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-md border p-4">
        <div>
          <span className="text-sm font-medium">
            {t('auth:account.twoFactor.backupCodes.title', {
              defaultValue: 'Backup Codes'
            })}
          </span>
          <p className="text-muted-foreground text-sm">
            {t('auth:account.twoFactor.backupCodes.description', {
              defaultValue: 'Use these codes if you lose your authenticator.'
            })}
          </p>
        </div>

        <RequirePassword
          render={
            <Button variant="outline" disabled={!enabled}>
              {t('common:regenerate', { defaultValue: 'Regenerate' })}
            </Button>
          }
          onConfirm={async data => {
            await generate.mutateAsync(data)
            setOpen(true)
          }}
        />
      </div>

      <BackupCodesModal open={open} onOpenChange={setOpen} />
    </>
  )
}
