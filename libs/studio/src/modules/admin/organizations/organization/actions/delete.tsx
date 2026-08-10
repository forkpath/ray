import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { toast } from 'sonner'

import { adminOrgMutations, useApiClient } from '@libs/api-client'
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
} from '@libs/ui-web'

import { pathsConfig } from '../../../../../config/paths'

interface DeleteOrgActionProps {
  readonly id: string
}

export function DeleteOrgAction({ id }: DeleteOrgActionProps) {
  const { t } = useTranslation(['common', 'admin'])
  const api = useApiClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const deleteOrg = useMutation(
    adminOrgMutations.delete.options(api, {
      onSuccess: () => {
        toast.success(
          t('organizations.organization.delete.success', {
            defaultValue: 'Organization deleted'
          })
        )
        void router.navigate({
          to: pathsConfig.admin.organizations.index as never
        })
      }
    })
  )

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
            {t('organizations.organization.delete.title', {
              defaultValue: 'Delete organization?'
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('admin:organizations.organization.delete.disclaimer')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel', { defaultValue: 'Cancel' })}</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteOrg.mutate({ id })} disabled={deleteOrg.isPending}>
            {deleteOrg.isPending && <Icons.Loader2 className="mr-1 size-3 animate-spin" />}
            {t('delete', { defaultValue: 'Delete' })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
