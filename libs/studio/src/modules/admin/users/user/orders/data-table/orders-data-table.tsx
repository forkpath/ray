import type { UseQueryOptions } from '@tanstack/react-query'
import type { GetUserOrdersRes } from '@libs/payload'

import { adminUserQueries, useApiClient } from '@libs/api-client'
import { DataTable, DataTableSkeleton, DataTableToolbar } from '@libs/ui-web'

import { useDataTable } from '../../../../../../common/hooks/use-data-table'
import { useColumns } from './columns'

interface OrdersDataTableProps {
  readonly userId: string
}

export function OrdersDataTable({ userId }: OrdersDataTableProps) {
  const api = useApiClient()
  const columns = useColumns()

  const { table, query } = useDataTable<
    GetUserOrdersRes['list'][number],
    GetUserOrdersRes,
    ReturnType<typeof adminUserQueries.orders>['queryKey']
  >({
    persistance: 'local',
    columns,
    query: ({ page, perPage }) =>
      adminUserQueries.orders(api, {
        id: userId,
        page,
        perPage
      }) as UseQueryOptions<
        GetUserOrdersRes,
        Error,
        GetUserOrdersRes,
        ReturnType<typeof adminUserQueries.orders>['queryKey']
      >,
    initialState: {
      pagination: { pageSize: 5, pageIndex: 0 }
    },
    enableRowSelection: false
  })

  if (query.isLoading) {
    return (
      <DataTableSkeleton columnCount={4} filterCount={1} cellWidths={['8rem', '6rem', '6rem', '8rem']} shrinkZero />
    )
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <DataTableToolbar table={table} />
      <DataTable table={table} />
    </div>
  )
}
