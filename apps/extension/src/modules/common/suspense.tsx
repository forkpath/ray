import type { ReactNode } from 'react'

import { Suspense as ReactSuspense } from 'react'

import { Icons } from '@libs/ui-web'

const Loading = () => {
  return (
    <div className="flex w-full min-w-64 items-center justify-center py-16">
      <Icons.Loader2 className="animate-spin" />
    </div>
  )
}

export const Suspense = ({ children, fallback = <Loading /> }: { children: ReactNode; fallback?: ReactNode }) => {
  return <ReactSuspense fallback={fallback}>{children}</ReactSuspense>
}
