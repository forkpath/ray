import type { ColumnDef } from '@tanstack/react-table'
import type { GetUserMembershipsRes } from '@libs/payload'

import { Link } from '@tanstack/react-router'

import { MemberRole } from '@libs/common'
import { useTranslation } from '@libs/i18n'
import { Avatar, AvatarFallback, AvatarImage, Badge, DataTableColumnHeader } from '@libs/ui-web'

import { pathsConfig } from '../../../../../../config/paths'

type MembershipRow = GetUserMembershipsRes['list'][number]

export const useColumns = (): ColumnDef<MembershipRow>[] => {
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
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <div className="ml-auto w-fit">
          <DataTableColumnHeader column={column} title={t('joinedAt')} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="ml-auto text-right">{new Date(row.original.createdAt).toLocaleDateString(i18n.language)}</div>
      ),
      meta: {
        label: t('joinedAt'),
        variant: 'dateRange'
      },
      enableColumnFilter: true
    }
  ]
}
