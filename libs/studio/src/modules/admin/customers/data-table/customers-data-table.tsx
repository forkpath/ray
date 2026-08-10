import type { UseQueryOptions } from '@tanstack/react-query'
import type { GetCustomersRes } from '@libs/payload'

import { adminCustomerQueries, useApiClient } from '@libs/api-client'
import { DataTable, DataTableToolbar } from '@libs/ui-web'

import { useDataTable } from '../../../../common/hooks/use-data-table'
import { useColumns } from './columns'

export function CustomersDataTable() {
  const api = useApiClient()
  const columns = useColumns()

  const { table } = useDataTable<
    GetCustomersRes['list'][number],
    GetCustomersRes,
    ReturnType<typeof adminCustomerQueries.list>['queryKey']
  >({
    persistance: 'local',
    columns,
    query: ({ page, perPage, sorting, filters }) => {
      const qValue = Array.isArray(filters.q) ? filters.q[0] : filters.q
      const q = typeof qValue === 'string' ? qValue : undefined

      return adminCustomerQueries.list(api, {
        page,
        perPage,
        sort: sorting,
        q,
        provider: Array.isArray(filters.provider) ? filters.provider.filter(Boolean) : undefined,
        subscriptions:
          Array.isArray(filters.subscriptions) && filters.subscriptions.length === 2
            ? [Number(filters.subscriptions[0]), Number(filters.subscriptions[1])]
            : undefined,
        orders:
          Array.isArray(filters.orders) && filters.orders.length === 2
            ? [Number(filters.orders[0]), Number(filters.orders[1])]
            : undefined,
        createdAt:
          Array.isArray(filters.createdAt) && filters.createdAt.length === 2
            ? [Number(filters.createdAt[0]), Number(filters.createdAt[1])]
            : undefined
      }) as UseQueryOptions<
        GetCustomersRes,
        Error,
        GetCustomersRes,
        ReturnType<typeof adminCustomerQueries.list>['queryKey']
      >
    },
    initialState: {
      sorting: [{ id: 'user.name', desc: false }],
      columnVisibility: { q: false }
    },
    enableRowSelection: false
  })

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  )
}
