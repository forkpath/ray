import type { ColumnDef } from '@tanstack/react-table'
import type { GetUserInvitationsRes } from '@libs/payload'

import { Link } from '@tanstack/react-router'

import { InvitationStatus, MemberRole } from '@libs/common'
import { useTranslation } from '@libs/i18n'
import { Avatar, AvatarFallback, AvatarImage, Badge, DataTableColumnHeader } from '@libs/ui-web'

import { pathsConfig } from '../../../../../../config/paths'

type InvitationRow = GetUserInvitationsRes['list'][number]

export const useColumns = (): ColumnDef<InvitationRow>[] => {
  const { t, i18n } = useTranslation('common')

  return [
    {
      id: 'organization',
      accessorFn: row => row.organization.name,
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('organization')} />,
      cell: ({ row }) => (
        <Link
          to={pathsConfig.admin.organizations.organization(row.original.organizationId)}
          className="group flex items-center gap-3"
        >
          <Avatar className="size-8">
            <AvatarImage src={row.original.organization.logo ?? undefined} alt={row.original.organization.name} />
            <AvatarFallback>
              <span className="text-muted-foreground text-xs uppercase">
                {row.original.organization.name.charAt(0)}
              </span>
            </AvatarFallback>
          </Avatar>
          <span className="group-hover:text-primary truncate font-medium underline underline-offset-4">
            {row.original.organization.name}
          </span>
        </Link>
      ),
      enableHiding: false
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
    }
  ]
}
