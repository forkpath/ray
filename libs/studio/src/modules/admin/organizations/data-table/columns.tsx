import type { ColumnDef } from '@tanstack/react-table'
import type { GetOrganizationsRes } from '@libs/payload'

import { Link } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { Avatar, AvatarFallback, AvatarImage, DataTableColumnHeader } from '@libs/ui-web'

import { pathsConfig } from '../../../../config/paths'

type OrgRow = GetOrganizationsRes['list'][number]

export const useColumns = (options?: { max?: { members: number } }): ColumnDef<OrgRow>[] => {
  const { t, i18n } = useTranslation('common')

  return [
    {
      id: 'q',
      accessorKey: 'q',
      meta: {
        placeholder: `${t('search')}...`,
        variant: 'text'
      },
      enableHiding: false,
      enableColumnFilter: true
    },
    {
      id: 'name',
      accessorKey: 'name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('name')} />,
      cell: ({ row }) => (
        <Link
          to={pathsConfig.admin.organizations.organization(row.original.id)}
          className="group flex items-center gap-3"
        >
          <Avatar>
            <AvatarImage src={row.original.logo ?? undefined} alt={row.original.name} />
            <AvatarFallback>
              <span className="text-muted-foreground text-sm uppercase">{row.original.name.charAt(0)}</span>
            </AvatarFallback>
          </Avatar>
          <span className="group-hover:text-primary truncate font-medium underline underline-offset-4">
            {row.original.name}
          </span>
        </Link>
      ),
      enableHiding: false
    },
    {
      id: 'slug',
      accessorKey: 'slug',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('slug')} />,
      cell: ({ row }) => <span>/{row.original.slug}</span>,
      meta: { label: 'Slug' }
    },
    {
      id: 'members',
      accessorKey: 'members',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('members')} />,
      cell: ({ row }) => <span>{row.original.members}</span>,
      meta: {
        label: t('members'),
        variant: 'range',
        range: [0, options?.max?.members ?? 100]
      },
      enableColumnFilter: true
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <div className="ml-auto w-fit">
          <DataTableColumnHeader column={column} title={t('createdAt')} />
        </div>
      ),
      cell: ({ row }) => (
        <div className="ml-auto text-right">{new Date(row.original.createdAt).toLocaleDateString(i18n.language)}</div>
      ),
      meta: {
        label: t('createdAt'),
        variant: 'dateRange'
      },
      enableColumnFilter: true
    }
  ]
}
