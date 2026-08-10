import type { UseQueryOptions } from '@tanstack/react-query'
import type { GetInvitationsRes } from '@libs/payload'

import { adminOrgQueries, useApiClient } from '@libs/api-client'
import { DataTable, DataTableSkeleton, DataTableToolbar } from '@libs/ui-web'

import { useDataTable } from '../../../../../../common/hooks/use-data-table'
import { useColumns } from './columns'

interface InvitationsDataTableProps {
  readonly orgId: string
}

export function OrgInvitationsDataTable({ orgId }: InvitationsDataTableProps) {
  const api = useApiClient()
  const columns = useColumns()

  const { table, query } = useDataTable<
    GetInvitationsRes['list'][number],
    GetInvitationsRes,
    ReturnType<typeof adminOrgQueries.invitations>['queryKey']
  >({
    persistance: 'local',
    columns,
    query: ({ page, perPage }) =>
      adminOrgQueries.invitations(api, { id: orgId, page, perPage }) as UseQueryOptions<
        GetInvitationsRes,
        Error,
        GetInvitationsRes,
        ReturnType<typeof adminOrgQueries.invitations>['queryKey']
      >,
    initialState: {
      pagination: { pageSize: 10, pageIndex: 0 }
    },
    enableRowSelection: false
  })

  if (query.isLoading) {
    return (
      <DataTableSkeleton columnCount={4} filterCount={4} cellWidths={['15rem', '5rem', '5rem', '8rem']} shrinkZero />
    )
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <DataTableToolbar table={table} />
      <DataTable table={table} />
    </div>
  )
}
