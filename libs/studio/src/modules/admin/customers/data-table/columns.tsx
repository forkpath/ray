import type { ColumnDef } from '@tanstack/react-table'
import type { GetCustomersRes } from '@libs/payload'

import { Link } from '@tanstack/react-router'

import { useTranslation } from '@libs/i18n'
import { Avatar, AvatarFallback, AvatarImage, Badge, DataTableColumnHeader, Icons } from '@libs/ui-web'

import { pathsConfig } from '../../../../config/paths'
import { authClient } from '../../../../lib/auth/client'

type CustomerRow = GetCustomersRes['list'][number]

export const useColumns = (options?: {
  max?: { subscriptions: number; orders: number }
  options?: { provider: string[] }
}): ColumnDef<CustomerRow>[] => {
  const { t, i18n } = useTranslation(['common', 'billing'])
  const { data: session } = authClient.useSession()

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
      id: 'user.name',
      accessorKey: 'user.name',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('name')} />,
      cell: ({ row }) => (
        <Link to={pathsConfig.admin.users.user(row.original.referenceId)} className="group flex items-center gap-3">
          <Avatar>
            <AvatarImage src={row.original.user.image ?? undefined} alt={row.original.user.name} />
            <AvatarFallback>
              <Icons.UserRound className="w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-2">
            <span className="group-hover:text-primary truncate font-medium underline underline-offset-4">
              {row.original.user.name}
            </span>
            {row.original.referenceId === session?.user.id && <Badge variant="outline">{t('you')}</Badge>}
          </div>
        </Link>
      ),
      enableHiding: false
    },
    {
      id: 'externalId',
      accessorKey: 'externalId',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('id')} />,
      meta: { label: t('id') }
    },
    {
      id: 'provider',
      accessorKey: 'provider',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('provider')} />,
      cell: ({ row }) => (
        <code className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs">{row.original.provider}</code>
      ),
      meta: {
        label: t('provider'),
        variant: 'multiSelect',
        options: options?.options?.provider.map(p => ({
          label: p,
          value: p
        }))
      },
      enableColumnFilter: true
    },
    {
      id: 'subscriptions',
      accessorKey: 'subscriptions',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('subscriptions')} />,
      meta: {
        label: t('subscriptions'),
        variant: 'range',
        range: [0, options?.max?.subscriptions ?? 10]
      },
      enableColumnFilter: true
    },
    {
      id: 'orders',
      accessorKey: 'orders',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('orders')} />,
      meta: {
        label: t('orders'),
        variant: 'range',
        range: [0, options?.max?.orders ?? 10]
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
