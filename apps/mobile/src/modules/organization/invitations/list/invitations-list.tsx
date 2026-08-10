import { useState } from 'react'
import { Fragment } from 'react/jsx-runtime'
import { useInfiniteQuery } from '@tanstack/react-query'

import { authClient } from '~/lib/auth'
import { organization } from '~/modules/organization/lib/api'
import { FlatList, RefreshControl, View } from 'react-native'

import { InvitationStatus } from '@libs/auth-contract'
import { pickBy } from '@libs/common/utils'
import { useTranslation } from '@libs/i18n'
import { cn } from '@libs/ui-shared/common'
import { Text } from '@libs/ui-shared/mobile/components/text'

import { InvitationsListFilters } from './invitations-list-filters'
import { InvitationListItem, InvitationListItemSkeleton } from './invitations-list-item'

export const InvitationsList = () => {
  const { t } = useTranslation(['common', 'organization'])
  const activeOrganization = authClient.useActiveOrganization()
  const [filters, setFilters] = useState<Record<string, string | string[] | null>>({
    status: [InvitationStatus.PENDING]
  })

  const perPage = 20
  const params = {
    id: activeOrganization.data?.id ?? '',
    perPage: perPage.toString(),
    sort: JSON.stringify([{ id: 'expiresAt', desc: true }]),
    ...pickBy(filters, Boolean)
  }

  const invitations = useInfiniteQuery(organization.queries.invitations.getAll(params))

  const data = invitations.data?.pages.flatMap(page => page.list) ?? []

  return (
    <View className="flex-1 gap-2">
      <InvitationsListFilters onFiltersChange={setFilters} />
      <View className="border-border flex-1 overflow-hidden rounded-md border">
        <FlatList
          data={data}
          renderItem={({ item }) => <InvitationListItem invitation={item as never} />}
          contentContainerClassName={cn({
            'flex-1': !data.length,
            'items-center justify-center': !data.length && !invitations.isLoading
          })}
          ItemSeparatorComponent={() => <View className="bg-border h-px w-full" />}
          showsVerticalScrollIndicator={false}
          onEndReached={() => invitations.fetchNextPage()}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            invitations.isFetchingNextPage && (
              <View>
                {Array.from({ length: 10 }).map((_, index) => (
                  <Fragment key={index}>
                    <View className="bg-border h-px w-full" />
                    <InvitationListItemSkeleton />
                  </Fragment>
                ))}
              </View>
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={invitations.isRefetching}
              onRefresh={() => invitations.refetch()}
              tintColorClassName="accent-primary"
              colorsClassName="accent-primary"
            />
          }
          ListEmptyComponent={
            invitations.isLoading ? (
              <View className="w-full items-start">
                {Array.from({ length: 10 }).map((_, index, arr) => (
                  <Fragment key={index}>
                    <InvitationListItemSkeleton />
                    {index !== arr.length - 1 && <View className="bg-border h-px w-full" />}
                  </Fragment>
                ))}
              </View>
            ) : (
              <Text>{t('noResults')}</Text>
            )
          }
        />
      </View>
    </View>
  )
}
