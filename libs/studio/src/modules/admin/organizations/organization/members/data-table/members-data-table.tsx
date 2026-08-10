import type { UseQueryOptions } from '@tanstack/react-query'
import type { GetMembersRes } from '@libs/payload'

import { adminOrgQueries, useApiClient } from '@libs/api-client'
import { DataTable, DataTableSkeleton, DataTableToolbar } from '@libs/ui-web'

import { useDataTable } from '../../../../../../common/hooks/use-data-table'
import { useColumns } from './columns'

interface MembersDataTableProps {
  readonly orgId: string
}

export function MembersDataTable({ orgId }: MembersDataTableProps) {
  const api = useApiClient()
  const columns = useColumns()

  const { table, query } = useDataTable<
    GetMembersRes['list'][number],
    GetMembersRes,
    ReturnType<typeof adminOrgQueries.members>['queryKey']
  >({
    persistance: 'local',
    columns,
    query: ({ page, perPage }) =>
      adminOrgQueries.members(api, { id: orgId, page, perPage }) as UseQueryOptions<
        GetMembersRes,
        Error,
        GetMembersRes,
        ReturnType<typeof adminOrgQueries.members>['queryKey']
      >,
    initialState: {
      pagination: { pageSize: 10, pageIndex: 0 }
    },
    enableRowSelection: false
  })

  if (query.isLoading) {
    return <DataTableSkeleton columnCount={3} filterCount={3} cellWidths={['15rem', '5rem', '8rem']} shrinkZero />
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <DataTableToolbar table={table} />
      <DataTable table={table} />
    </div>
  )
}
