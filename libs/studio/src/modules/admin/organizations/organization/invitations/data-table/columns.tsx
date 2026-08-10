import type { ColumnDef } from '@tanstack/react-table'
import type { GetInvitationsRes } from '@libs/payload'

import { useMutation, useQueryClient } from '@tanstack/react-query'

import { toast } from 'sonner'

import { adminOrgKeys, adminOrgMutations, useApiClient } from '@libs/api-client'
import { InvitationStatus, MemberRole } from '@libs/common'
import { useTranslation } from '@libs/i18n'
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DataTableColumnHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Icons
} from '@libs/ui-web'

type InvitationRow = GetInvitationsRes['list'][number]

function InvitationActions({ invitation }: { invitation: InvitationRow }) {
  const { t } = useTranslation(['common', 'admin'])
  const api = useApiClient()
  const queryClient = useQueryClient()

  const cancelInvitation = useMutation(
    adminOrgMutations.deleteInvitation.options(api, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: adminOrgKeys.invitations(invitation.organizationId)
        })
        toast.success(
          t('admin:organizations.organization.invitations.cancel.success', { defaultValue: 'Invitation cancelled' })
        )
      }
    })
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <span className="sr-only">{t('actions')}</span>
          <Icons.Ellipsis className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          className="text-destructive"
          onSelect={() =>
            cancelInvitation.mutate({
              orgId: invitation.organizationId,
              invitationId: invitation.id
            })
          }
          disabled={cancelInvitation.isPending}
        >
          {t('cancel')}
          {cancelInvitation.isPending && <Icons.Loader2 className="ml-auto size-3 animate-spin" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const useColumns = (): ColumnDef<InvitationRow>[] => {
  const { t, i18n } = useTranslation('common')

  return [
    {
      id: 'email',
      accessorKey: 'email',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('email')} />,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>
              <Icons.UserRound className="w-5" />
            </AvatarFallback>
          </Avatar>
          <span className="truncate font-medium">{row.original.email}</span>
        </div>
      ),
      enableHiding: false,
      meta: {
        placeholder: `${t('search')}...`,
        variant: 'text'
      },
      enableColumnFilter: true
    },
    {
      id: 'role',
      accessorKey: 'role',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('role')} />,
      cell: ({ row }) => <Badge variant="outline">{t(row.original.role)}</Badge>,
      meta: {
        label: t('role'),
        variant: 'multiSelect',
        options: Object.values(MemberRole).map(role => ({
          label: t(role),
          value: role
        }))
      },
      enableColumnFilter: true
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
      cell: ({ row }) => <Badge variant="secondary">{t(row.original.status)}</Badge>,
      meta: {
        label: t('status'),
        variant: 'multiSelect',
        options: Object.values(InvitationStatus).map(status => ({
          label: t(status),
          value: status
        }))
      },
      enableColumnFilter: true
    },
    {
      id: 'expiresAt',
      accessorKey: 'expiresAt',
      header: ({ column }) => (
        <div className="ml-auto w-fit">
          <DataTableColumnHeader column={column} title={t('expiresAt')} />
        </div>
      ),
      cell: ({ row }) => {
        const isExpired = new Date(row.original.expiresAt) < new Date()
        return (
          <div className={`ml-auto text-right ${isExpired ? 'text-destructive' : ''}`}>
            {new Date(row.original.expiresAt).toLocaleString(i18n.language, {
              hour: '2-digit',
              minute: '2-digit',
              year: 'numeric',
              month: 'numeric',
              day: '2-digit'
            })}
          </div>
        )
      },
      meta: {
        label: t('expiresAt'),
        variant: 'dateRange'
      },
      enableColumnFilter: true
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="ml-auto w-fit">
          <InvitationActions invitation={row.original} />
        </div>
      ),
      enableHiding: false
    }
  ]
}
