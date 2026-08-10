import type { UseQueryOptions } from '@tanstack/react-query'
import type { GetOrganizationsRes } from '@libs/payload'

import { adminOrgQueries, useApiClient } from '@libs/api-client'
import { DataTable, DataTableToolbar } from '@libs/ui-web'

import { useDataTable } from '../../../../common/hooks/use-data-table'
import { useColumns } from './columns'

export function OrganizationsDataTable() {
  const api = useApiClient()
  const columns = useColumns()

  const { table } = useDataTable<
    GetOrganizationsRes['list'][number],
    GetOrganizationsRes,
    ReturnType<typeof adminOrgQueries.list>['queryKey']
  >({
    persistance: 'local',
    columns,
    query: ({ page, perPage, sorting, filters }) => {
      const qValue = Array.isArray(filters.q) ? filters.q[0] : filters.q
      const q = typeof qValue === 'string' ? qValue : undefined

      return adminOrgQueries.list(api, {
        page,
        perPage,
        sort: sorting,
        q,
        createdAt:
          Array.isArray(filters.createdAt) && filters.createdAt.length === 2
            ? [Number(filters.createdAt[0]), Number(filters.createdAt[1])]
            : undefined,
        members:
          Array.isArray(filters.members) && filters.members.length === 2
            ? [Number(filters.members[0]), Number(filters.members[1])]
            : undefined
      }) as UseQueryOptions<
        GetOrganizationsRes,
        Error,
        GetOrganizationsRes,
        ReturnType<typeof adminOrgQueries.list>['queryKey']
      >
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
