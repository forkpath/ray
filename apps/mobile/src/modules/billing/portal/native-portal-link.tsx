import { useMutation } from '@tanstack/react-query'

import { useCustomer } from '@libs/billing-native'
import { Button, buttonTextVariants, Icons, Spin } from '@libs/ui-native'

export const NativePortalLink = ({
  children,
  store,
  variantId,
  ...props
}: React.ComponentProps<typeof Button> & {
  store: string
  variantId?: string
}) => {
  const { linkToPortal } = useCustomer()

  const link = useMutation({
    mutationFn: () => linkToPortal({ store, variantId })
  })

  return (
    <Button {...props} onPress={() => link.mutate()} disabled={link.isPending || props.disabled}>
      {link.isPending ? (
        <Spin>
          <Icons.Loader2 size={20} className={buttonTextVariants({ variant: props.variant })} />
        </Spin>
      ) : (
        children
      )}
    </Button>
  )
}
