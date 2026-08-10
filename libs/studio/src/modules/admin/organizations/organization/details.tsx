import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { toast } from 'sonner'

import { adminOrgKeys, adminOrgMutations, adminOrgQueries, useApiClient } from '@libs/api-client'
import { useTranslation } from '@libs/i18n'
import { Icons, Input } from '@libs/ui-web'

import { useDebounceCallback } from '../../../../common/hooks/use-debounce'
import { DetailsList, DetailsListItem } from '../../layout/details-list'

interface OrganizationDetailsProps {
  readonly id: string
}

export function OrganizationDetails({ id }: OrganizationDetailsProps) {
  const { t, i18n } = useTranslation(['common', 'admin'])
  const api = useApiClient()
  const queryClient = useQueryClient()
  const { data: organization } = useQuery(adminOrgQueries.detail(api, { id }))

  const [name, setName] = useState(organization?.name ?? '')
  const [slug, setSlug] = useState(organization?.slug ?? '')

  const updateOrg = useMutation(
    adminOrgMutations.update.options(api, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: adminOrgKeys.detail(id)
        })
        toast.success(
          t('admin:organizations.organization.details.update.success', { defaultValue: 'Organization updated' })
        )
      }
    })
  )

  const debouncedSaveName = useDebounceCallback(
    useCallback(
      (newName: string) => {
        updateOrg.mutate({ id, name: newName })
      },
      [id, updateOrg]
    ),
    2000
  )

  const debouncedSaveSlug = useDebounceCallback(
    useCallback(
      (newSlug: string) => {
        updateOrg.mutate({ id, slug: newSlug })
      },
      [id, updateOrg]
    ),
    2000
  )

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    debouncedSaveName(e.target.value)
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value)
    debouncedSaveSlug(e.target.value)
  }

  const details = [
    {
      id: 'name',
      component: (
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{t('name')}</span>
            {updateOrg.isPending && <Icons.Loader2 className="size-3 animate-spin" />}
          </div>
          <Input value={name} onChange={handleNameChange} disabled={updateOrg.isPending} />
        </div>
      ),
      visible: true
    },
    {
      id: 'slug',
      component: (
        <div className="flex flex-col items-start gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">{t('slug')}</span>
            {updateOrg.isPending && <Icons.Loader2 className="size-3 animate-spin" />}
          </div>
          <div className="relative w-full">
            <span className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
              /
            </span>
            <Input value={slug} onChange={handleSlugChange} disabled={updateOrg.isPending} className="pl-6" />
          </div>
        </div>
      ),
      visible: true
    },
    {
      id: 'createdAt',
      component: (
        <div className="flex flex-col items-start gap-3">
          <span className="text-sm font-medium">{t('createdAt')}</span>
          <span>{organization?.createdAt ? new Date(organization.createdAt).toLocaleString(i18n.language) : '-'}</span>
        </div>
      ),
      visible: true
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
