import type { UseQueryOptions } from '@tanstack/react-query'
import type { GetUserMembershipsRes } from '@libs/payload'

import { adminUserQueries, useApiClient } from '@libs/api-client'
import { DataTable, DataTableSkeleton, DataTableToolbar } from '@libs/ui-web'

import { useDataTable } from '../../../../../../common/hooks/use-data-table'
import { useColumns } from './columns'

interface MembershipsDataTableProps {
  readonly userId: string
}

export function MembershipsDataTable({ userId }: MembershipsDataTableProps) {
  const api = useApiClient()
  const columns = useColumns()

  const { table, query } = useDataTable<
    GetUserMembershipsRes['list'][number],
    GetUserMembershipsRes,
    ReturnType<typeof adminUserQueries.memberships>['queryKey']
  >({
    persistance: 'local',
    columns,
    query: ({ page, perPage }) =>
      adminUserQueries.memberships(api, {
        id: userId,
        page,
        perPage
      }) as UseQueryOptions<
        GetUserMembershipsRes,
        Error,
        GetUserMembershipsRes,
        ReturnType<typeof adminUserQueries.memberships>['queryKey']
      >,
    initialState: {
      pagination: { pageSize: 5, pageIndex: 0 }
    },
    enableRowSelection: false
  })

  if (query.isLoading) {
    return <DataTableSkeleton columnCount={3} filterCount={2} cellWidths={['15rem', '5rem', '8rem']} shrinkZero />
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <DataTableToolbar table={table} />
      <DataTable table={table} />
    </div>
  )
}
