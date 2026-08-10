import type { ColumnDef } from '@tanstack/react-table'
import type { GetUserAccountsRes } from '@libs/payload'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { toast } from 'sonner'

import { adminUserKeys, adminUserMutations, useApiClient } from '@libs/api-client'
import { useTranslation } from '@libs/i18n'
import {
  Badge,
  Button,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icons
} from '@libs/ui-web'

import { SetPasswordModal } from '../set-password'

type AccountRow = GetUserAccountsRes['list'][number]

function AccountActions({ account, userId }: { account: AccountRow; userId: string }) {
  const { t } = useTranslation(['common', 'admin'])
  const api = useApiClient()
  const queryClient = useQueryClient()
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  const deleteAccount = useMutation(
    adminUserMutations.deleteAccount.options(api, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: adminUserKeys.accounts(userId)
        })
        toast.success(
          t('admin:users.user.accounts.delete.success', {
            defaultValue: 'Account deleted'
          })
        )
      }
    })
  )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <span className="sr-only">{t('actions')}</span>
            <Icons.Ellipsis className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {account.providerId === 'credential' && (
            <>
              <DropdownMenuItem onSelect={() => setPasswordModalOpen(true)}>
                {t('admin:users.user.accounts.setPassword', {
                  defaultValue: 'Set password'
                })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() =>
              deleteAccount.mutate({
                userId,
                accountId: account.id
              })
            }
            disabled={deleteAccount.isPending}
          >
            {t('delete', { defaultValue: 'Delete' })}
            {deleteAccount.isPending && <Icons.Loader2 className="ml-auto size-3 animate-spin" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SetPasswordModal userId={userId} open={passwordModalOpen} onOpenChange={setPasswordModalOpen} />
    </>
  )
}

export const useColumns = (userId: string): ColumnDef<AccountRow>[] => {
  const { t, i18n } = useTranslation('common')

  return [
    {
      id: 'providerId',
      accessorKey: 'providerId',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('provider')} />,
      cell: ({ row }) => <Badge variant="outline">{row.original.providerId}</Badge>,
      meta: {
        label: t('provider'),
        variant: 'multiSelect',
        options: [
          { label: 'Credential', value: 'credential' },
          { label: 'Google', value: 'google' },
          { label: 'GitHub', value: 'github' }
        ]
      },
      enableColumnFilter: true,
      enableHiding: false
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('createdAt')} />,
      cell: ({ row }) => <div>{new Date(row.original.createdAt).toLocaleString(i18n.language)}</div>,
      meta: {
        label: t('createdAt'),
        variant: 'dateRange'
      },
      enableColumnFilter: true
    },
    {
      id: 'updatedAt',
      accessorKey: 'updatedAt',
      header: ({ column }) => (
        <div className="ml-auto w-fit">
          <DataTableColumnHeader column={column} title={t('updatedAt')} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="ml-auto text-right">{new Date(row.original.updatedAt).toLocaleString(i18n.language)}</div>
      )
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="ml-auto w-fit">
          <AccountActions account={row.original} userId={userId} />
        </div>
      ),
      enableHiding: false
    }
  ]
}
