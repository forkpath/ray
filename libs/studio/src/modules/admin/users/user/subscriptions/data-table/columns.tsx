import type { ColumnDef } from '@tanstack/react-table'
import type { GetUserSubscriptionsRes } from '@libs/payload'

import { BillingSubscriptionStatus } from '@libs/common'
import { useTranslation } from '@libs/i18n'
import { Badge, DataTableColumnHeader } from '@libs/ui-web'

type SubRow = GetUserSubscriptionsRes['list'][number]

export const useColumns = (): ColumnDef<SubRow>[] => {
  const { t, i18n } = useTranslation(['common', 'billing'])

  return [
    {
      id: 'variantId',
      accessorKey: 'variantId',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('billing:variant')} />,
      enableHiding: false
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('status')} />,
      cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge>,
      meta: {
        label: t('status'),
        variant: 'multiSelect',
        options: Object.values(BillingSubscriptionStatus).map(status => ({
          label: status,
          value: status
        }))
      },
      enableColumnFilter: true
    },
    {
      id: 'store',
      accessorKey: 'store',
      header: ({ column }) => <DataTableColumnHeader column={column} title={t('store')} />,
      cell: ({ row }) => <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{row.original.store}</code>
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
