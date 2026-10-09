import type { QueryKey, useQuery } from '@tanstack/react-query'
import type { useReactTable } from '@tanstack/react-table'
import type { UseLocalDataTableProps } from './local'
import type { UseSearchParamsDataTableProps } from './search-params'

import { useRef } from 'react'

import { useLocalDataTable } from './local'
import { useSearchParamsDataTable } from './search-params'

export function useDataTable<
  TData,
  TQueryFnData extends { list?: TData[]; total?: number },
  TQueryKey extends QueryKey
>(
  props: UseLocalDataTableProps<TData, TQueryFnData, TQueryKey>
): {
  table: ReturnType<typeof useReactTable<TData>>
  query: ReturnType<typeof useQuery<TQueryFnData>>
}
export function useDataTable<TData>(props: UseSearchParamsDataTableProps<TData>): {
  table: ReturnType<typeof useReactTable<TData>>
}

export function useDataTable<
  TData,
  TQueryFnData extends { list?: TData[]; total?: number },
  TQueryKey extends QueryKey
>(props: UseLocalDataTableProps<TData, TQueryFnData, TQueryKey> | UseSearchParamsDataTableProps<TData>) {
  // persistance 决定调用哪一个 hook，必须在组件生命周期内保持不变，否则 hook 顺序会错乱。
  const persistance = useRef(props.persistance).current
  if (props.persistance !== persistance) {
    throw new Error(`useDataTable persistance cannot change from "${persistance}" to "${props.persistance}"`)
  }

  if (props.persistance === 'local') {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- 分支在首次渲染后固定，见上方校验
    return useLocalDataTable(props)
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks -- 分支在首次渲染后固定，见上方校验
  return useSearchParamsDataTable(props)
}

export type { UseLocalDataTableProps } from './local'
export type { UseSearchParamsDataTableProps } from './search-params'
export * from './common'
