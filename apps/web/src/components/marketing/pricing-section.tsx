import React, { useState } from 'react'
import { Link } from '@tanstack/react-router'

import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { tiers } from '~/constants/marketing/pricing'

import { Badge } from './badge'
import { Button } from './button'
import { Container } from './container'
import { DivideX } from './divide'
import { CheckIcon } from './icons/card-icons'
import { Scale } from './scale'
import { SectionHeading } from './section-heading'
import { SlidingNumber } from './sliding-number'

/* 首页定价板块 */
export const PricingSection = () => {
  const { t } = useTranslation('marketing')
  const tabs = [
    { title: t('pricing.monthly'), value: 'monthly', badge: '' },
    {
      title: t('pricing.yearly'),
      value: 'yearly',
      badge: t('pricing.save20')
    }
  ]
  const [activeTier, setActiveTier] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <section>
      <Container className="border-divide flex flex-col items-center justify-center border-x pt-10 pb-10">
        <Badge text={t('pricing.badge')} />
        <SectionHeading className="mt-4">{t('pricing.title')}</SectionHeading>
        <div className="relative mt-8 flex items-center gap-4 rounded-xl bg-gray-50 p-2 dark:bg-neutral-800">
          <Scale className="opacity-50" />
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTier(tab.value as 'monthly' | 'yearly')}
              className="relative z-20 flex w-32 justify-center py-1 text-center sm:w-40"
            >
              {activeTier === tab.value && (
                <motion.div
                  layoutId="active-span"
                  className="shadow-aceternity absolute inset-0 h-full w-full rounded-md bg-white dark:bg-neutral-950"
                />
              )}
              <span className="relative z-20 flex items-center gap-2 text-sm sm:text-base">
                {tab.title}
                {tab.badge && (
                  <span className="bg-primary/10 text-primary rounded-full px-2 py-1 text-xs font-medium">
                    {tab.badge}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </Container>
      <DivideX />
      <Container className="border-divide border-x">
        <div className="divide-divide grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          {tiers.map(tier => (
            <div className="p-4 md:p-8" key={tier.title}>
              <h3 className="text-charcoal-700 text-xl font-medium dark:text-neutral-100">{tier.title}</h3>
              <p className="text-base text-gray-600 dark:text-neutral-400">{tier.subtitle}</p>
              <span className="mt-6 flex items-baseline-last text-2xl font-medium dark:text-white">
                $
                <SlidingNumber value={activeTier === 'monthly' ? tier.monthly : tier.yearly} />
                <span className="ml-2 text-sm font-normal">{t('pricing.perSeat')}</span>
              </span>
              <div className="flex flex-col gap-4 px-0 py-4 md:hidden md:p-8">
                {tier.features.map((f, i) => (
                  <div key={i} className="text-charcoal-700 flex items-center gap-2 dark:text-neutral-100">
                    <CheckIcon className="h-4 w-4 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <Button
                className="mt-6 w-full"
                as={Link}
                to={tier.ctaLink}
                variant={tier.featured ? 'brand' : 'secondary'}
              >
                {t('cta.startUsing')}
              </Button>
            </div>
          ))}
        </div>
      </Container>
      <DivideX />
      <Container className="border-divide hidden border-x md:block">
        <div className="divide-divide grid grid-cols-1 md:grid-cols-3 md:divide-x">
          {tiers.map(tier => (
            <div key={tier.title + '-features'} className="flex flex-col gap-4 p-4 md:p-8">
              {tier.features.map((f, i) => (
                <div key={i} className="text-charcoal-700 flex items-center gap-2 dark:text-neutral-100">
                  <CheckIcon className="h-4 w-4 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
