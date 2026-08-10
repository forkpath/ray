import { useBillingSummary } from '~/modules/billing/lib/api'
import { View } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { Text } from '@libs/ui-shared/mobile/components/text'

import { SubscriptionsListItem } from './subscriptions-list-item'

export const SubscriptionsList = () => {
  const { t } = useTranslation(['common', 'billing'])

  const summary = useBillingSummary()

  const subscriptions = summary.data?.flatMap(customer => customer.subscriptions) ?? []

  if (!subscriptions.length) {
    return null
  }

  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="font-sans-semibold text-2xl tracking-tight">{t('subscriptions')}</Text>
        <Text className="text-muted-foreground text-sm">{t('settings.subscriptions.description')}</Text>
      </View>

      {subscriptions.map(subscription => (
        <SubscriptionsListItem key={subscription.id} subscription={subscription} />
      ))}
    </View>
  )
}
