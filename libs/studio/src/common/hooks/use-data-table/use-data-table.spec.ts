import type { UseLocalDataTableProps } from './local'
import type { UseSearchParamsDataTableProps } from './search-params'

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDataTable } from '.'

vi.mock('./local', () => ({ useLocalDataTable: vi.fn(() => ({ mode: 'local' })) }))
vi.mock('./search-params', () => ({ useSearchParamsDataTable: vi.fn(() => ({ mode: 'searchParams' })) }))

type Props = UseLocalDataTableProps<object, { list?: object[] }, string[]> | UseSearchParamsDataTableProps<object>

const local = { persistance: 'local' } as unknown as Props
const searchParams = { persistance: 'searchParams' } as unknown as Props

describe('useDataTable', () => {
  it('dispatches to the hook matching the persistance mode', () => {
    expect(renderHook(() => useDataTable(local as UseSearchParamsDataTableProps<object>)).result.current).toEqual({
      mode: 'local'
    })
    expect(
      renderHook(() => useDataTable(searchParams as UseSearchParamsDataTableProps<object>)).result.current
    ).toEqual({ mode: 'searchParams' })
  })

  it('rejects switching persistance between renders', () => {
    const { rerender } = renderHook((props: Props) => useDataTable(props as UseSearchParamsDataTableProps<object>), {
      initialProps: local
    })
    expect(() => rerender(searchParams)).toThrow(
      'useDataTable persistance cannot change from "local" to "searchParams"'
    )
  })
})
