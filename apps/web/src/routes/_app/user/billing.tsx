import type { BillingSubscriptionRecord, BillingSummary } from '@libs/billing-contract'

import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { useApiClient } from '@libs/api-client'
import { billingMutations, billingQueries } from '@libs/billing-client'
import { billingConfig } from '@libs/billing-config'
import { BillingPlan, BillingSubscriptionStatus } from '@libs/billing-contract'
import { useTranslation } from '@libs/i18n'
import { authClient, PageHeader, PageHeaderDescription, PageHeaderTitle } from '@libs/studio'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Icons,
  Skeleton
} from '@libs/ui-shared/web'

export const Route = createFileRoute('/_app/user/billing')({
  component: BillingPage
})

function BillingPage() {
  const { t } = useTranslation('billing')
  const api = useApiClient()
  const session = authClient.useSession()
  const userId = session.data?.user.id ?? null
  const summaryQuery = useQuery({
    ...billingQueries.summary(api, { kind: 'user', userId }),
    enabled: Boolean(userId)
  })
  const summary = summaryQuery.data as BillingSummary | undefined

  const subscriptions = summary?.flatMap(c => c.subscriptions) ?? []
  const orders = summary?.flatMap(c => c.orders) ?? []

  const activeSubscription = subscriptions.find(
    sub => sub.status === BillingSubscriptionStatus.ACTIVE || sub.status === BillingSubscriptionStatus.TRIALING
  )

  const hasData = subscriptions.length > 0 || orders.length > 0

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader>
        <div className="flex flex-col gap-1.5">
          <PageHeaderTitle>{t('title')}</PageHeaderTitle>
          <PageHeaderDescription>{t('description')}</PageHeaderDescription>
        </div>
      </PageHeader>

      <div className="grid max-w-2xl gap-6">
        {summaryQuery.isLoading && <Skeleton className="h-64" />}

        {!summaryQuery.isLoading && !hasData && <BillingEmpty />}

        {!summaryQuery.isLoading && hasData && activeSubscription && (
          <ActivePlanCard subscription={activeSubscription} />
        )}

        {!summaryQuery.isLoading && hasData && subscriptions.length > 0 && (
          <SubscriptionsList subscriptions={subscriptions} />
        )}

        {!summaryQuery.isLoading && hasData && <PortalCard />}
      </div>
    </div>
  )
}

function BillingEmpty() {
  const { t } = useTranslation('billing')
  const freePlan = billingConfig.plans.find(p => p.id === BillingPlan.FREE)

  if (!freePlan) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('plan.title', { defaultValue: 'Your plan' })}</CardTitle>
        <CardDescription>
          {t('plan.description', { defaultValue: 'Below are the details of your current plan.' })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Icons.ClockFading className="text-muted-foreground size-5" />
          <span className="text-lg font-semibold">{t(freePlan.name, { defaultValue: 'Free' })}</span>
          <Badge variant="success">{t('plan.active', { defaultValue: 'Active' })}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          {t(freePlan.description, { defaultValue: freePlan.description })}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {freePlan.features.map(feature => (
            <div key={feature} className="flex items-center gap-2">
              <Icons.Check className="text-primary size-4 shrink-0" />
              <span className="text-sm">{t(feature, { defaultValue: feature })}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <UpgradeButton />
      </CardFooter>
    </Card>
  )
}

function ActivePlanCard({ subscription }: { subscription: BillingSubscriptionRecord }) {
  const { t } = useTranslation('billing')

  const activePlan =
    billingConfig.plans.find(plan => plan.variants.some(v => v.id === subscription.variantId)) ?? billingConfig.plans[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('plan.title', { defaultValue: 'Your plan' })}</CardTitle>
        <CardDescription>
          {t('plan.description', { defaultValue: 'Below are the details of your current plan.' })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Icons.ClockFading className="text-muted-foreground size-5" />
          <span className="text-lg font-semibold">
            {activePlan ? t(activePlan.name, { defaultValue: activePlan.id }) : subscription.variantId}
          </span>
          <Badge variant="success">
            {subscription.status === BillingSubscriptionStatus.TRIALING
              ? t('plan.trialing', { defaultValue: 'Trial' })
              : t('plan.active', { defaultValue: 'Active' })}
          </Badge>
        </div>
        {activePlan && (
          <>
            <p className="text-muted-foreground text-sm">
              {t(activePlan.description, { defaultValue: activePlan.description })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {activePlan.features.map(feature => (
                <div key={feature} className="flex items-center gap-2">
                  <Icons.Check className="text-primary size-4 shrink-0" />
                  <span className="text-sm">{t(feature, { defaultValue: feature })}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <UpgradeButton />
      </CardFooter>
    </Card>
  )
}

function SubscriptionsList({ subscriptions }: { subscriptions: BillingSubscriptionRecord[] }) {
  const { t, i18n } = useTranslation('billing')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('subscriptions.title', { defaultValue: 'Subscriptions' })}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {subscriptions.map(sub => (
            <li key={sub.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{sub.variantId}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(sub.periodStartsAt).toLocaleDateString(i18n.language)} –{' '}
                  {new Date(sub.periodEndsAt).toLocaleDateString(i18n.language)}
                </span>
              </div>
              <Badge
                variant={
                  sub.status === BillingSubscriptionStatus.ACTIVE
                    ? 'success'
                    : sub.status === BillingSubscriptionStatus.TRIALING
                      ? 'outline'
                      : 'destructive'
                }
              >
                {sub.status}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function PortalCard() {
  const { t } = useTranslation('billing')
  const api = useApiClient()
  const currentUrl = typeof window === 'undefined' ? 'http://localhost:3000/user/billing' : window.location.href

  const portalMutation = useMutation({
    ...billingMutations.portal.options(api),
    onSuccess: result => {
      window.location.assign(result.url)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('portal.title', { defaultValue: 'Billing Portal' })}</CardTitle>
        <CardDescription>
          {t('portal.description', {
            defaultValue: 'Manage your payment methods, invoices, and subscription details.'
          })}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => portalMutation.mutate({ returnUrl: currentUrl })}
          disabled={portalMutation.isPending}
        >
          {portalMutation.isPending ? (
            <Icons.Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              {t('portal.open', { defaultValue: 'Open Billing Portal' })}
              <Icons.ArrowUpRight className="ml-2 size-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

function UpgradeButton() {
  const { t } = useTranslation('billing')
  const api = useApiClient()
  const currentUrl = typeof window === 'undefined' ? 'http://localhost:3000/user/billing' : window.location.href

  const premiumPlan = billingConfig.plans.find(p => p.id === BillingPlan.PREMIUM)
  const defaultVariant = premiumPlan?.variants.find(v => v.stripePriceId)

  const checkoutMutation = useMutation({
    ...billingMutations.checkout.options(api),
    onSuccess: result => {
      if (result.url) {
        window.location.assign(result.url)
      }
    }
  })

  if (!defaultVariant) return null

  return (
    <Button
      className="w-full"
      onClick={() =>
        checkoutMutation.mutate({
          variantId: defaultVariant.id,
          successUrl: currentUrl,
          cancelUrl: currentUrl
        })
      }
      disabled={checkoutMutation.isPending}
    >
      {checkoutMutation.isPending ? (
        <Icons.Loader2 className="size-4 animate-spin" />
      ) : (
        <>
          {t('plan.upgrade', { defaultValue: 'Upgrade' })}
          <Icons.ArrowUpRight className="ml-2 size-4" />
        </>
      )}
    </Button>
  )
}
