import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { toast } from 'sonner'

import { adminUserKeys, adminUserMutations, useApiClient } from '@libs/api-client'
import { useTranslation } from '@libs/i18n'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Icons,
  Input
} from '@libs/ui-web'

interface SetPasswordModalProps {
  readonly userId: string
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function SetPasswordModal({ userId, open, onOpenChange }: SetPasswordModalProps) {
  const { t } = useTranslation(['common', 'admin'])
  const api = useApiClient()
  const queryClient = useQueryClient()
  const [password, setPassword] = useState('')

  const setPasswordMutation = useMutation(
    adminUserMutations.setPassword.options(api, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: adminUserKeys.accounts(userId)
        })
        toast.success(
          t('admin:users.user.accounts.setPassword.success', {
            defaultValue: 'Password set successfully'
          })
        )
        setPassword('')
        onOpenChange(false)
      }
    })
  )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('admin:users.user.accounts.setPassword.title', {
              defaultValue: 'Set password'
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('admin:users.user.accounts.setPassword.description', {
              defaultValue: 'Set a new password for this user. They will be able to log in with this password.'
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Input
            type="password"
            placeholder={t('admin:users.user.accounts.setPassword.placeholder', {
              defaultValue: 'New password'
            })}
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              setPasswordMutation.mutate({
                id: userId,
                newPassword: password
              })
            }
            disabled={setPasswordMutation.isPending || password.length < 8}
          >
            {setPasswordMutation.isPending && <Icons.Loader2 className="mr-1 size-3 animate-spin" />}
            {t('admin:users.user.accounts.setPassword.submit', {
              defaultValue: 'Set password'
            })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
