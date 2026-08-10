import type { PaywallCallbacks } from '@libs/billing-contract'
import type { CustomerInfo } from 'react-native-purchases'
import type { PresentPaywallParams } from 'react-native-purchases-ui'

import { useState } from 'react'

import Purchases from 'react-native-purchases'
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui'

import { PaywallResult } from '@libs/billing-contract'

import { normalizePaywallResult } from './paywall-result'

type UsePaywallArgs = Omit<PaywallCallbacks, 'onPresent' | 'onPurchase' | 'onRestore' | 'onError'> & {
  onPresent?: ({ params }: { params: PresentPaywallParams }) => void
  onPurchase?: ({ customerInfo }: { customerInfo: CustomerInfo }) => void
  onRestore?: ({ customerInfo }: { customerInfo: CustomerInfo }) => void
  onError?: (error?: Error) => void
}

export const usePaywall = (args?: UsePaywallArgs) => {
  const [result, setResult] = useState<PaywallResult>(PaywallResult.IDLE)

  const present = async ({ trigger, ...params }: PresentPaywallParams & { trigger: string }) => {
    try {
      await Purchases.setAttributes({ trigger })
      args?.onPresent?.({ params })

      const nativeResult = await RevenueCatUI.presentPaywall(params)
      setResult(normalizePaywallResult(nativeResult))

      if (nativeResult === PAYWALL_RESULT.NOT_PRESENTED) {
        args?.onSkip?.()
        return
      }

      args?.onDismiss?.()

      switch (nativeResult) {
        case PAYWALL_RESULT.PURCHASED: {
          const customerInfo = await Purchases.getCustomerInfo()
          args?.onPurchase?.({ customerInfo })
          return
        }
        case PAYWALL_RESULT.RESTORED: {
          const customerInfo = await Purchases.getCustomerInfo()
          args?.onRestore?.({ customerInfo })
          return
        }
        case PAYWALL_RESULT.CANCELLED:
          return
        case PAYWALL_RESULT.ERROR:
          args?.onError?.()
          return
      }
    } catch (error) {
      setResult(PaywallResult.ERROR)
      args?.onError?.(error instanceof Error ? error : undefined)
    }
  }

  return { present, result }
}
