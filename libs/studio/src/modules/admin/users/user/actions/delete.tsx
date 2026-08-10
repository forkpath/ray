import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { toast } from 'sonner'

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
  AlertDialogTrigger,
  Button,
  Icons
} from '@libs/ui-shared/web'

import { pathsConfig } from '../../../../../config/paths'
import { admin } from '../../../lib/api'

interface DeleteActionProps {
  readonly id: string
}

export function DeleteAction({ id }: DeleteActionProps) {
  const { t } = useTranslation(['common', 'admin'])
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const deleteUser = useMutation({
    ...admin.mutations.users.delete,
    onSuccess: () => {
      toast.success(
        t('users.user.delete.success', {
          defaultValue: 'User deleted'
        })
      )
      void router.navigate({ to: pathsConfig.admin.users.index as never })
    }
  })

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Icons.Trash className="mr-1 size-4" />
          {t('common:delete')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('users.user.delete.title', {
              defaultValue: 'Delete user?'
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('admin:users.user.delete.disclaimer')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel', { defaultValue: 'Cancel' })}</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteUser.mutate({ userId: id })} disabled={deleteUser.isPending}>
            {deleteUser.isPending && <Icons.Loader2 className="mr-1 size-3 animate-spin" />}
            {t('delete', { defaultValue: 'Delete' })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
