import { useQuery } from '@tanstack/react-query'

import { FeaturesList } from '~/modules/billing/features-list'
import { billing } from '~/modules/billing/lib/api'
import { OrdersList } from '~/modules/billing/orders/list/orders-list'
import { BillingInfo } from '~/modules/billing/portal/billing-info'
import { SubscriptionsList } from '~/modules/billing/subscriptions/list/subscriptions-list'
import { ScrollView } from '~/modules/common/styled'
import { View } from 'react-native'

import { findPlanById } from '@libs/billing'
import { BillingPlan, SubscriptionStatus } from '@libs/billing-contract'
import { usePaywall } from '@libs/billing-native'
import { useTranslation } from '@libs/i18n'
import { Badge } from '@libs/ui-shared/mobile/components/badge'
import { Button } from '@libs/ui-shared/mobile/components/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@libs/ui-shared/mobile/components/card'
import { Icons } from '@libs/ui-shared/mobile/components/icons'
import { Skeleton } from '@libs/ui-shared/mobile/components/skeleton'
import { Text } from '@libs/ui-shared/mobile/components/text'

/**
 * When there is no billing information available, we show an empty state
 * that treats the user as a free user with an option to upgrade.
 */
const BillingEmpty = () => {
  const { t } = useTranslation(['common', 'billing'])

  const { present } = usePaywall()

  const plan = findPlanById(BillingPlan.FREE)

  if (!plan) {
    return null
  }

  return (
    <View className="bg-background flex-1 gap-4 px-6 py-4">
      <View className="gap-1">
        <Text className="font-sans-semibold text-2xl tracking-tight">{t('settings.yourPlan.title')}</Text>
        <Text className="text-muted-foreground text-sm">{t('settings.yourPlan.description')}</Text>
      </View>

      <Card>
        <CardHeader>
          <View className="flex-row items-center justify-start gap-2">
            <Icons.BadgeCheck size={20} />
            <CardTitle>{t(`plan.${BillingPlan.FREE}.name`)}</CardTitle>
            <Badge variant="success" className="ml-1 capitalize">
              <Text className="text-success">{t(`subscription.status.${SubscriptionStatus.ACTIVE}`)}</Text>
            </Badge>
          </View>

          <CardDescription>{t(`plan.${BillingPlan.FREE}.description`)}</CardDescription>
        </CardHeader>

        <CardContent className="gap-1">
          <FeaturesList planId={BillingPlan.FREE} />
        </CardContent>

        <CardFooter>
          <Button
            className="w-full"
            onPress={() =>
              present({
                trigger: 'billing'
              })
            }
          >
            <Text>{t('upgrade')}</Text>
          </Button>
        </CardFooter>
      </Card>
    </View>
  )
}

const BillingLoading = () => {
  return (
    <View className="bg-background flex-1 gap-4 px-6 py-4">
      <View className="gap-2">
        <Skeleton className="h-9 w-44" style={{ width: 176 }} />
        <Skeleton className="h-6 w-56" style={{ width: 224, height: 24 }} />
      </View>

      <Skeleton className="h-30" />
      <Skeleton className="h-30" />
    </View>
  )
}

export default function Billing() {
  const summary = useQuery(billing.queries.summary.get)

  if (summary.isPending) {
    return <BillingLoading />
  }

  if (summary.data?.every(customer => !customer.subscriptions.length && !customer.orders.length)) {
    return <BillingEmpty />
  }

  return (
    <ScrollView
      className="bg-background px-6"
      contentContainerClassName="gap-8 pt-4 pb-8"
      showsVerticalScrollIndicator={false}
    >
      <SubscriptionsList />
      <OrdersList />
      <BillingInfo />
    </ScrollView>
  )
}
