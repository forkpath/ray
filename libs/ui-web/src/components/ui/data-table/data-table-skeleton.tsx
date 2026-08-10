import { Skeleton } from '../skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../table'

interface DataTableSkeletonProps {
  columnCount: number
  rowCount?: number
  filterCount?: number
  cellWidths?: string[]
  shrinkZero?: boolean
}

export function DataTableSkeleton({
  columnCount,
  rowCount = 5,
  filterCount = 0,
  cellWidths = [],
  shrinkZero = false
}: DataTableSkeletonProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      {filterCount > 0 && (
        <div className="flex items-center gap-2">
          {Array.from({ length: filterCount }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
          <div className="ml-auto">
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columnCount }).map((_, i) => (
                <TableHead
                  key={i}
                  style={
                    cellWidths[i]
                      ? {
                          width: cellWidths[i],
                          minWidth: shrinkZero ? '0' : undefined
                        }
                      : undefined
                  }
                >
                  <Skeleton className="h-4 w-full" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: columnCount }).map((_, j) => (
                  <TableCell
                    key={j}
                    style={
                      cellWidths[j]
                        ? {
                            width: cellWidths[j],
                            minWidth: shrinkZero ? '0' : undefined
                          }
                        : undefined
                    }
                  >
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
