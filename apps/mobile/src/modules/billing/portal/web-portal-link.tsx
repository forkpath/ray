import { useMutation } from '@tanstack/react-query'

import * as Linking from 'expo-linking'
import { Alert } from 'react-native'

import { useTranslation } from '@libs/i18n'
import { Button, buttonTextVariants, Icons, Spin } from '@libs/ui-native'

import { pathsConfig } from '~/config/paths'
import { billing } from '~/modules/billing/lib/api'

export const WebPortalLink = ({
  children,
  redirectUrl = pathsConfig.dashboard.user.settings.billing,
  ...props
}: React.ComponentProps<typeof Button> & { redirectUrl?: string }) => {
  const { t } = useTranslation('billing')
  const getPortal = useMutation({
    ...billing.mutations.portal,
    onSuccess: data => {
      if (!data.url) {
        return Alert.alert(t('error.portal'))
      }
      return Linking.openURL(data.url)
    }
  })

  return (
    <Button
      onPress={() =>
        getPortal.mutate({
          returnUrl: Linking.createURL(redirectUrl)
        })
      }
      disabled={getPortal.isPending || props.disabled}
      {...props}
    >
      {getPortal.isPending ? (
        <Spin>
          <Icons.Loader2 size={20} className={buttonTextVariants({ variant: props.variant })} />
        </Spin>
      ) : (
        children
      )}
    </Button>
  )
}
