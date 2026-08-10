import { cn } from '@libs/ui-core'

/* 水平分割线 */
export const DivideX = ({ className }: { className?: string }) => {
  return <div className={cn('bg-divide h-[1px] w-full', className)} />
}
