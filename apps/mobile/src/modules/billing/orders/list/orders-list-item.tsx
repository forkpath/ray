import type { Order } from '@libs/billing-contract'

import { FeaturesList } from '~/modules/billing/features-list'
import { NativePortalLink } from '~/modules/billing/portal/native-portal-link'
import { WebPortalLink } from '~/modules/billing/portal/web-portal-link'
import { View } from 'react-native'

import { findPlanByVariantId } from '@libs/billing'
import { MobileStore, PaymentStatus } from '@libs/billing-contract'
import { isKey, useTranslation } from '@libs/i18n'
import { Badge } from '@libs/ui-shared/mobile/components/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@libs/ui-shared/mobile/components/card'
import { Icons } from '@libs/ui-shared/mobile/components/icons'
import { Text } from '@libs/ui-shared/mobile/components/text'

export const OrdersListItem = ({ order }: { order: Order }) => {
  const { t, i18n } = useTranslation(['common', 'billing'])
  const { plan } = findPlanByVariantId(order.variantId)

  const name = plan?.name
  const description = plan?.description

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center justify-start gap-2">
          {order.status === PaymentStatus.SUCCEEDED ? (
            <Icons.BadgeCheck size={20} className="text-foreground" />
          ) : (
            <Icons.BadgeX size={20} className="text-foreground" />
          )}
          {name && <CardTitle>{isKey(name, i18n, 'billing') ? t(name) : name}</CardTitle>}
          <Badge
            variant={
              order.status === PaymentStatus.SUCCEEDED
                ? 'success'
                : order.status === PaymentStatus.FAILED
                  ? 'destructive'
                  : 'secondary'
            }
          >
            <Text>{t(`order.status.${order.status}`)}</Text>
          </Badge>
        </View>
        {description && (
          <CardDescription>{isKey(description, i18n, 'billing') ? t(description) : description}</CardDescription>
        )}
      </CardHeader>

      {plan?.id && (
        <CardContent>
          <FeaturesList planId={plan.id} />
        </CardContent>
      )}

      <CardFooter className="flex-col gap-2">
        {(Object.values(MobileStore) as string[]).includes(order.store) ? (
          <NativePortalLink
            store={order.store as MobileStore}
            variantId={order.variantId}
            variant="outline"
            className="w-full gap-1"
          >
            <Text>{t('order.cta')}</Text>
            <Icons.ArrowUpRight className="text-foreground" size={18} />
          </NativePortalLink>
        ) : (
          <WebPortalLink variant="outline" className="w-full gap-1">
            <Text>{t('order.cta')}</Text>
            <Icons.ArrowUpRight className="text-foreground" size={18} />
          </WebPortalLink>
        )}

        <View className="w-full flex-row items-center justify-between gap-2">
          <Text className="text-muted-foreground text-xs">{t('updatedAt')}</Text>

          <Text className="text-foreground text-xs">{order.updatedAt.toLocaleString(i18n.language)}</Text>
        </View>
      </CardFooter>
    </Card>
  )
}
