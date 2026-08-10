import type { UseQueryOptions } from '@tanstack/react-query'
import type { GetUsersRes } from '@libs/payload'

import { adminUserQueries, useApiClient } from '@libs/api-client'
import { DataTable, DataTableToolbar } from '@libs/ui-web'

import { useDataTable } from '../../../../common/hooks/use-data-table'
import { useColumns } from './columns'

export function UsersDataTable() {
  const api = useApiClient()
  const columns = useColumns()

  const { table } = useDataTable<
    GetUsersRes['list'][number],
    GetUsersRes,
    ReturnType<typeof adminUserQueries.list>['queryKey']
  >({
    persistance: 'local',
    columns,
    query: ({ page, perPage, sorting, filters }) => {
      const qValue = Array.isArray(filters.q) ? filters.q[0] : filters.q

      return adminUserQueries.list(api, {
        page,
        perPage,
        sort: sorting,
        q: typeof qValue === 'string' ? qValue : undefined,
        role: Array.isArray(filters.role)
          ? filters.role.filter((value): value is 'user' | 'admin' => value === 'user' || value === 'admin')
          : undefined,
        twoFactorEnabled: Array.isArray(filters.twoFactorEnabled)
          ? filters.twoFactorEnabled.filter(Boolean).map(value => value === 'true')
          : undefined,
        banned: Array.isArray(filters.banned)
          ? filters.banned.filter(Boolean).map(value => value === 'true')
          : undefined,
        createdAt:
          Array.isArray(filters.createdAt) && filters.createdAt.length === 2
            ? [Number(filters.createdAt[0]), Number(filters.createdAt[1])]
            : undefined
      }) as UseQueryOptions<GetUsersRes, Error, GetUsersRes, ReturnType<typeof adminUserQueries.list>['queryKey']>
    },
    initialState: {
      sorting: [{ id: 'name', desc: false }],
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
