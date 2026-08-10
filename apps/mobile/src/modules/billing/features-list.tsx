import type { BillingPlan } from '@libs/billing-contract'

import { View } from 'react-native'

import { findPlanById } from '@libs/billing-config'
import { isKey, useTranslation } from '@libs/i18n'
import { Icons } from '@libs/ui-shared/mobile/components/icons'
import { Text } from '@libs/ui-shared/mobile/components/text'

export const FeaturesList = ({ planId }: { planId: BillingPlan }) => {
  const { t, i18n } = useTranslation('billing')

  const plan = findPlanById(planId)

  if (!plan) {
    return null
  }

  return (
    <View className="gap-1.5">
      {plan.features.map(feature => {
        const featureKey = `feature.${feature.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())}`
        return (
          <View key={feature} className="flex-row items-center justify-start gap-2">
            <Icons.Check size={16} className="text-foreground" />
            <Text className="text-sm">{isKey(featureKey, i18n, 'billing') ? t(featureKey) : featureKey}</Text>
          </View>
        )
      })}
    </View>
  )
}
