import type { UseQueryOptions } from '@tanstack/react-query'
import type { GetUserAccountsRes } from '@libs/payload'

import { adminUserQueries, useApiClient } from '@libs/api-client'
import { DataTable, DataTableSkeleton, DataTableToolbar } from '@libs/ui-web'

import { useDataTable } from '../../../../../../common/hooks/use-data-table'
import { useColumns } from './columns'

interface AccountsDataTableProps {
  readonly id: string
}

export function AccountsDataTable({ id }: AccountsDataTableProps) {
  const api = useApiClient()
  const columns = useColumns(id)

  const { table, query } = useDataTable<
    GetUserAccountsRes['list'][number],
    GetUserAccountsRes,
    ReturnType<typeof adminUserQueries.accounts>['queryKey']
  >({
    persistance: 'local',
    columns,
    query: ({ page, perPage }) =>
      adminUserQueries.accounts(api, {
        id,
        page,
        perPage
      }) as UseQueryOptions<
        GetUserAccountsRes,
        Error,
        GetUserAccountsRes,
        ReturnType<typeof adminUserQueries.accounts>['queryKey']
      >,
    initialState: {
      pagination: { pageSize: 5, pageIndex: 0 }
    },
    enableRowSelection: false
  })

  if (query.isLoading) {
    return <DataTableSkeleton columnCount={3} filterCount={1} cellWidths={['10rem', '10rem', '8rem']} shrinkZero />
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <DataTableToolbar table={table} />
      <DataTable table={table} />
    </div>
  )
}
