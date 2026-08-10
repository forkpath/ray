import type { UseQueryOptions } from '@tanstack/react-query'
import type { GetUserInvitationsRes } from '@libs/payload'

import { adminUserQueries, useApiClient } from '@libs/api-client'
import { DataTable, DataTableSkeleton, DataTableToolbar } from '@libs/ui-web'

import { useDataTable } from '../../../../../../common/hooks/use-data-table'
import { useColumns } from './columns'

interface InvitationsDataTableProps {
  readonly userId: string
}

export function InvitationsDataTable({ userId }: InvitationsDataTableProps) {
  const api = useApiClient()
  const columns = useColumns()

  const { table, query } = useDataTable<
    GetUserInvitationsRes['list'][number],
    GetUserInvitationsRes,
    ReturnType<typeof adminUserQueries.invitations>['queryKey']
  >({
    persistance: 'local',
    columns,
    query: ({ page, perPage }) =>
      adminUserQueries.invitations(api, {
        id: userId,
        page,
        perPage
      }) as UseQueryOptions<
        GetUserInvitationsRes,
        Error,
        GetUserInvitationsRes,
        ReturnType<typeof adminUserQueries.invitations>['queryKey']
      >,
    initialState: {
      pagination: { pageSize: 5, pageIndex: 0 }
    },
    enableRowSelection: false
  })

  if (query.isLoading) {
    return (
      <DataTableSkeleton
        columnCount={5}
        filterCount={3}
        cellWidths={['10rem', '5rem', '5rem', '5rem', '8rem']}
        shrinkZero
      />
    )
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <DataTableToolbar table={table} />
      <DataTable table={table} />
    </div>
  )
}
