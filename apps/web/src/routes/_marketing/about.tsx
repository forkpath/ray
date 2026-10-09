import { createFileRoute } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { Badge } from '~/components/marketing/badge'
import { Container } from '~/components/marketing/container'
import { CTA } from '~/components/marketing/cta'
import { DivideX } from '~/components/marketing/divide'
import { Heading } from '~/components/marketing/heading'
import { LinkedInIcon } from '~/components/marketing/icons/general'
import { InformationBlock } from '~/components/marketing/information-block'
import { ProgressiveBlur } from '~/components/marketing/progressive-blur'
import { SectionHeading } from '~/components/marketing/section-heading'
import { SubHeading } from '~/components/marketing/subheading'
import { Testimonials } from '~/components/marketing/testimonials'
import { careers } from '~/constants/marketing/careers'
import { founders } from '~/constants/marketing/founders'

/* 关于页面路由 */
export const Route = createFileRoute('/_marketing/about')({
  head: () => ({
    meta: [
      { title: 'About - Ray' },
      {
        name: 'description',
        content: 'Learn about the team behind Ray and our mission to revolutionize AI-driven workflows.'
      }
    ]
  }),
  component: AboutPage
})

function AboutPage() {
  const { t } = useTranslation('marketing')

  return (
    <>
      {/* Hero 双列布局 */}
      <DivideX />
      <Container className="border-divide flex flex-col items-center justify-center border-x px-4 pt-10 pb-10 md:px-8 md:pt-32 md:pb-20">
        <div className="grid grid-cols-1 gap-20 md:grid-cols-2">
          <div className="flex flex-col items-start justify-start">
            <Badge text={t('about.badge')} />
            <Heading className="mt-4 text-left">{t('about.title')}</Heading>
            <SubHeading className="mt-6 mr-auto text-left">
              {t('about.description')}
              <br />
              <br />
              {t('about.description2')}
            </SubHeading>
          </div>
          <div className="border-divide rounded-3xl border p-2">
            <img
              src="https://images.unsplash.com/photo-1552581234-26160f608093?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
              alt="About Us"
              className="h-full rounded-2xl object-cover"
              draggable={false}
            />
          </div>
        </div>
        {/* 媒体报道 Logo */}
        <div className="mt-20 flex w-full flex-col items-center lg:flex-row">
          <h2 className="mb-4 min-w-40 text-center font-mono text-sm tracking-tight text-neutral-500 uppercase lg:mb-0 lg:text-left dark:text-neutral-400">
            {t('about.featuredIn')}
          </h2>
          <div className="grid w-full grid-cols-2 items-center gap-4 md:grid-cols-4">
            {['bloomberg', 'wired', 'forbes', 'the-guardian'].map(name => (
              <img
                key={name}
                src={`/marketing/logos/${name}.png`}
                alt={name}
                className="h-6 w-auto object-contain dark:invert dark:filter"
                draggable={false}
              />
            ))}
          </div>
        </div>
      </Container>

      {/* 客户评价 */}
      <Testimonials />

      {/* 历程与价值 */}
      <Container className="border-divide border-x border-t p-4 py-20 md:px-8 md:py-40">
        <div className="grid grid-cols-1 gap-10 md:gap-20 lg:grid-cols-2">
          <div className="flex flex-col items-start justify-start">
            <Badge text={t('about.journeyBadge')} />
            <SectionHeading className="mt-4 text-left">{t('about.journeyTitle')}</SectionHeading>
            <SubHeading className="mt-6 mr-auto text-left">{t('about.journeySubtitle')}</SubHeading>
            <div className="divide-divide mt-8 grid grid-cols-3 gap-6">
              <MetricBlock value="1.2M+" label={t('about.metrics.workflows')} />
              <MetricBlock value="6.4k" label={t('about.metrics.community')} />
              <MetricBlock value="1.2K" label={t('about.metrics.reviews')} />
            </div>
          </div>
          <InformationBlock />
        </div>
      </Container>
      <DivideX />

      {/* 团队 - 大尺寸卡片 */}
      <Container className="border-divide flex flex-col items-center border-x py-16">
        <Badge text={t('about.teamBadge')} />
        <SectionHeading className="mt-4">{t('about.teamTitle')}</SectionHeading>
        <SubHeading className="mx-auto mt-6 max-w-lg px-4">{t('about.teamSubtitle')}</SubHeading>
        <div className="mt-12 grid w-full grid-cols-1 gap-6 px-4 md:grid-cols-2 md:px-8 lg:grid-cols-3">
          {founders.map(founder => (
            <div
              className="group relative h-60 overflow-hidden rounded-2xl md:h-100"
              key={founder.name + founder.title}
            >
              <img
                src={founder.src}
                alt={founder.name}
                className="h-full w-full object-cover object-top"
                draggable={false}
              />
              <ProgressiveBlur
                className="pointer-events-none absolute bottom-0 left-0 hidden h-[30%] w-full transition-all duration-200 group-hover:block"
                blurIntensity={2}
              />
              <div className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-xl bg-black/80 px-4 py-2">
                <div>
                  <h3 className="text-sm font-medium text-white">{founder.name}</h3>
                  <p className="text-sm text-neutral-300">{founder.title}</p>
                </div>
                <a href={founder.url} target="_blank" rel="noreferrer" className="cursor-pointer">
                  <LinkedInIcon className="h-5 w-5 text-white" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </Container>
      <DivideX />

      {/* 招聘 CTA（含投资人 Logo） */}
      <Container className="border-divide flex flex-col items-center border-x border-b pb-20">
        <div className="divide-divide border-divide grid grid-cols-1 border-b lg:grid-cols-2 lg:divide-x">
          <div className="flex flex-col items-start justify-start px-4 py-10 md:px-8 md:py-20">
            <Badge text={t('about.careersBadge')} />
            <SectionHeading className="mt-4 text-left">{t('about.careersTitle')}</SectionHeading>
            <SubHeading className="mt-6 mr-auto max-w-md text-left">{t('about.careersSubtitle')}</SubHeading>
            <div className="mt-4 flex items-center gap-2">
              <p className="text-charcoal-700 text-base font-medium dark:text-neutral-100">{t('about.joinTeam')}</p>
              <div className="flex items-center">
                {founders.slice(0, 3).map(founder => (
                  <img
                    key={founder.name}
                    src={founder.src}
                    alt={founder.name}
                    className="-mr-3 size-10 rounded-full border border-white object-cover"
                    draggable={false}
                  />
                ))}
                <div className="flex size-10 items-center justify-center rounded-full bg-gray-300">
                  <p className="text-charcoal-700 text-sm font-medium">{founders.length - 3}+</p>
                </div>
              </div>
            </div>
            <h2 className="mt-8 text-left font-mono text-sm tracking-tight text-neutral-500 uppercase dark:text-neutral-400">
              {t('about.investors')}
            </h2>
            <div className="mt-8 grid w-full grid-cols-3 items-center gap-10">
              {['y-combinator', 'accel', 'softbank'].map(name => (
                <img
                  key={name}
                  src={`/marketing/logos/${name}.png`}
                  alt={name}
                  className="h-6 w-auto object-contain dark:invert dark:filter"
                  draggable={false}
                />
              ))}
            </div>
          </div>
          <div className="divide-divide border-divide divide-y border-t lg:border-t-0">
            {careers.slice(0, 4).map(career => (
              <a
                href={career.href}
                key={career.id}
                className="block cursor-pointer px-4 py-4 hover:bg-gray-100 md:px-8 dark:hover:bg-neutral-800"
              >
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                  <h3 className="text-brand font-medium">{career.title}</h3>
                  <div className="hidden size-1 rounded-full bg-gray-400 sm:block dark:bg-neutral-600" />
                  <p className="text-sm text-gray-600 dark:text-neutral-200">{career.location}</p>
                </div>
                <p className="mt-2 font-medium text-neutral-500 dark:text-neutral-200">{career.description}</p>
              </a>
            ))}
          </div>
        </div>
      </Container>

      {/* 底部 CTA */}
      <CTA />
      <DivideX />
    </>
  )
}

function MetricBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-start justify-start">
      <h3 className="text-charcoal-700 text-3xl font-medium dark:text-neutral-100">{value}</h3>
      <p className="text-sm text-gray-600 dark:text-neutral-400">{label}</p>
    </div>
  )
}
