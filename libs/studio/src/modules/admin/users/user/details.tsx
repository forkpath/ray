import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from 'sonner'

import { adminUserKeys, adminUserMutations, useApiClient } from '@libs/api-client'
import { UserRole } from '@libs/common'
import { useTranslation } from '@libs/i18n'
import { Icons, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@libs/ui-web'

import { useDebounceCallback } from '../../../../common/hooks/use-debounce'
import { DetailsList, DetailsListItem } from '../../layout/details-list'
import { admin } from '../../lib/api'

interface UserDetailsProps {
  readonly id: string
}

export function UserDetails({ id }: UserDetailsProps) {
  const { t, i18n } = useTranslation(['common', 'admin'])
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { data: user } = useQuery(admin.queries.users.get({ id }))

  const [name, setName] = useState(user?.name ?? '')

  const updateUser = useMutation(
    adminUserMutations.update.options(api, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: adminUserKeys.detail(id)
        })
        toast.success(
          t('admin:users.user.details.update.success', {
            defaultValue: 'User updated'
          })
        )
      }
    })
  )

  const debouncedSaveName = useDebounceCallback(
    useCallback(
      (newName: string) => {
        updateUser.mutate({ id, data: { name: newName } })
      },
      [id, updateUser]
    ),
    2000
  )

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    debouncedSaveName(e.target.value)
  }

  const handleRoleChange = (newRole: string) => {
    updateUser.mutate({
      id,
      data: { role: newRole as 'user' | 'admin' }
    })
  }

  const details = [
    {
      id: 'name',
      component: (
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{t('name')}</span>
            {updateUser.isPending && <Icons.Loader2 className="size-3 animate-spin" />}
          </div>
          <Input value={name} onChange={handleNameChange} disabled={updateUser.isPending} />
        </div>
      ),
      visible: true
    },
    {
      id: 'role',
      component: (
        <div className="flex flex-col items-start gap-3">
          <span className="text-sm font-medium">{t('role')}</span>
          <Select value={user?.role ?? 'user'} onValueChange={handleRoleChange} disabled={updateUser.isPending}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t('role')} />
            </SelectTrigger>
            <SelectContent>
              {Object.values(UserRole).map(role => (
                <SelectItem key={role} value={role}>
                  {t(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ),
      visible: true
    },
    {
      id: 'twoFactorEnabled',
      component: (
        <div className="flex flex-col items-start gap-3">
          <span className="text-sm font-medium">
            {t('admin:users.user.details.twoFactorAuth', {
              defaultValue: 'Two-factor Authentication'
            })}
          </span>
          <span>{user?.twoFactorEnabled ? t('enabled') : t('disabled')}</span>
        </div>
      ),
      visible: true
    },
    {
      id: 'createdAt',
      component: (
        <div className="flex flex-col items-start gap-3">
          <span className="text-sm font-medium">{t('createdAt')}</span>
          <span>{user?.createdAt ? new Date(user.createdAt).toLocaleString(i18n.language) : '-'}</span>
        </div>
      ),
      visible: true
    },
    {
      id: 'updatedAt',
      component: (
        <div className="flex flex-col items-start gap-3">
          <span className="text-sm font-medium">{t('updatedAt')}</span>
          <span>{user?.updatedAt ? new Date(user.updatedAt).toLocaleString(i18n.language) : '-'}</span>
        </div>
      ),
      visible: true
    },
    {
      id: 'banExpires',
      component: (
        <div className="flex flex-col items-start gap-3">
          <span className="text-sm font-medium">{t('banExpiresIn')}</span>
          {user?.banExpires ? (
            <span>{new Date(user.banExpires).toLocaleString(i18n.language)}</span>
          ) : (
            <span>{t('never')}</span>
          )}
        </div>
      ),
      visible: !!user?.banned
    },
    {
      id: 'banReason',
      component: (
        <div className="flex flex-col items-start gap-3">
          <span className="text-sm font-medium">{t('banReason')}</span>
          <p>{user?.banReason}</p>
        </div>
      ),
      visible: !!user?.banned
    }
  ]

  return (
    <section className="@container/details w-full overflow-hidden">
      <DetailsList>
        {details
          .filter(d => d.visible)
          .map(d => (
            <DetailsListItem key={d.id}>{d.component}</DetailsListItem>
          ))}
      </DetailsList>
    </section>
  )
}
