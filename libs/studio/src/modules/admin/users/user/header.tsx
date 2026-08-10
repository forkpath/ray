import { useQuery } from '@tanstack/react-query'

import { useTranslation } from '@libs/i18n'
import { Avatar, AvatarFallback, AvatarImage, Badge, Icons } from '@libs/ui-web'

import { PageHeader, PageHeaderDescription, PageHeaderTitle } from '../../../../common/components/layout/page-header'
import { authClient } from '../../../../lib/auth/client'
import { admin } from '../../lib/api'
import { BanAction } from './actions/ban'
import { DeleteAction } from './actions/delete'
import { ImpersonateAction } from './actions/impersonate'

interface UserHeaderProps {
  readonly id: string
}

export function UserHeader({ id }: UserHeaderProps) {
  const { t } = useTranslation('common')
  const session = authClient.useSession()
  const { data: user } = useQuery(admin.queries.users.get({ id }))

  return (
    <PageHeader>
      <div className="flex min-w-0 items-center gap-4">
        <Avatar className="size-12">
          <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? ''} />
          <AvatarFallback>
            <Icons.UserRound className="w-7" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <PageHeaderTitle className="truncate">{user?.name}</PageHeaderTitle>
            {user?.isAnonymous && <Badge variant="outline">{t('anonymous')}</Badge>}
            {user?.id === session.data?.user.id && <Badge variant="outline">{t('you')}</Badge>}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <PageHeaderDescription>{user?.email}</PageHeaderDescription>
            <Badge variant={user?.emailVerified ? 'success' : 'destructive'}>
              {user?.emailVerified ? t('verified') : t('unverified')}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ImpersonateAction id={id} />
        <BanAction id={id} />
        <DeleteAction id={id} />
      </div>
    </PageHeader>
  )
}
