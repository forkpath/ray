import type { Subscription } from '@libs/billing-contract'

import dayjs from 'dayjs'
import { View } from 'react-native'

import { getBillingPeriod } from '@libs/billing-config'
import { useTranslation } from '@libs/i18n'
import { Progress, Text } from '@libs/ui-native'

interface BillingPeriodProgressProps {
  subscription: Subscription
}

export const BillingPeriodProgress = ({ subscription }: BillingPeriodProgressProps) => {
  const { t } = useTranslation(['common', 'billing'])

  const { progress, daysRemaining, trial, startsAt, endsAt } = getBillingPeriod(subscription)

  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-xs">{trial ? t('trial.label') : t('currentBillingCycle')}</Text>
        <Text className="text-muted-foreground text-xs">{t('daysRemaining', { count: daysRemaining })}</Text>
      </View>
      <Progress value={progress} />
      <View className="flex-row items-center justify-between gap-2">
        <Text className="text-muted-foreground text-xs">{dayjs(startsAt).format('Do MMM')}</Text>
        <Text className="text-muted-foreground text-xs">{dayjs(endsAt).format('Do MMM')}</Text>
      </View>
    </View>
  )
}
