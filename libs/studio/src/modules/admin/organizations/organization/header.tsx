import { useQuery } from '@tanstack/react-query'

import { adminOrgQueries, useApiClient } from '@libs/api-client'
import { Avatar, AvatarFallback, AvatarImage } from '@libs/ui-web'

import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '../../../../common/components/layout/page-header'
import { DeleteOrgAction } from './actions/delete'

interface OrganizationHeaderProps {
  readonly id: string
}

export function OrganizationHeader({ id }: OrganizationHeaderProps) {
  const api = useApiClient()
  const { data: organization } = useQuery(adminOrgQueries.detail(api, { id }))

  return (
    <PageHeader>
      <div className="flex min-w-0 items-center gap-4">
        <Avatar className="size-12">
          <AvatarImage src={organization?.logo ?? undefined} alt={organization?.name ?? ''} />
          <AvatarFallback>
            <span className="text-muted-foreground text-lg uppercase">{organization?.name?.charAt(0)}</span>
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <PageHeaderTitle className="truncate">{organization?.name}</PageHeaderTitle>
          <div className="flex items-center gap-2">
            <PageHeaderDescription>/{organization?.slug}</PageHeaderDescription>
          </div>
        </div>
      </div>
      <DeleteOrgAction id={id} />
    </PageHeader>
  )
}
