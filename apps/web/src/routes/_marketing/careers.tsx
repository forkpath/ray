import { createFileRoute, Link } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { cn } from '@libs/ui-core'

import { Badge } from '~/components/marketing/badge'
import { Button } from '~/components/marketing/button'
import { Container } from '~/components/marketing/container'
import { CTA } from '~/components/marketing/cta'
import { DivideX } from '~/components/marketing/divide'
import {
  BoltIcon,
  CloudCheckIcon,
  HeartHandsIcon,
  ShieldSplitIcon,
  SparklesIcon,
  TelescopeIcon
} from '~/components/marketing/icons/card-icons'
import { ScalesContainer } from '~/components/marketing/scales-container'
import { SectionHeading } from '~/components/marketing/section-heading'
import { SubHeading } from '~/components/marketing/subheading'
import { careers } from '~/constants/marketing/careers'

/* 招聘页面路由 */
export const Route = createFileRoute('/_marketing/careers')({
  head: () => ({
    meta: [
      { title: 'Careers - Ray' },
      {
        name: 'description',
        content: 'Join our team and build the future of AI-driven workflows.'
      }
    ]
  }),
  component: CareersPage
})

const teamImages = [
  { src: '/marketing/team/1.png', className: 'lg:col-span-2 col-span-1' },
  { src: '/marketing/team/2.png', className: 'lg:col-span-2 col-span-1' },
  { src: '/marketing/team/3.png', className: 'lg:col-span-4 col-span-1' },
  { src: '/marketing/team/4.png', className: 'lg:col-span-3 col-span-1' },
  { src: '/marketing/team/5.png', className: 'lg:col-span-3 col-span-1' },
  { src: '/marketing/team/6.png', className: 'lg:col-span-2 col-span-1' }
]

function CareersPage() {
  const { t } = useTranslation('marketing')
  const uniqueDepartments = [...new Set(careers.map(c => c.department))]

  const why = [
    {
      title: t('careers.why.ownership.title'),
      description: t('careers.why.ownership.description'),
      icon: <CloudCheckIcon className="text-brand size-6" />
    },
    {
      title: t('careers.why.highPaced.title'),
      description: t('careers.why.highPaced.description'),
      icon: <BoltIcon className="text-brand size-6" />
    },
    {
      title: t('careers.why.integrity.title'),
      description: t('careers.why.integrity.description'),
      icon: <ShieldSplitIcon className="text-brand size-6" />
    },
    {
      title: t('careers.why.people.title'),
      description: t('careers.why.people.description'),
      icon: <HeartHandsIcon className="text-brand size-6" />
    },
    {
      title: t('careers.why.impact.title'),
      description: t('careers.why.impact.description'),
      icon: <SparklesIcon className="text-brand size-6" />
    },
    {
      title: t('careers.why.vision.title'),
      description: t('careers.why.vision.description'),
      icon: <TelescopeIcon className="text-brand size-4" />
    }
  ]

  return (
    <>
      {/* Hero 双列布局 */}
      <DivideX />
      <Container className="border-divide flex flex-col items-center border-x pb-20">
        <div className="divide-divide border-divide grid grid-cols-1 border-b lg:grid-cols-2 lg:divide-x">
          <div className="flex flex-col items-start justify-start px-4 py-10 md:px-8 md:py-32">
            <Badge text={t('careers.badge')} />
            <SectionHeading className="mt-4 text-left">{t('careers.title')}</SectionHeading>
            <SubHeading className="mt-6 mr-auto max-w-md text-left">{t('careers.subtitle')}</SubHeading>
            <Button as={Link} to="/auth/login" className="mt-4">
              {t('cta.startUsing')}
            </Button>

            <h2 className="mt-8 text-left font-mono text-sm tracking-tight text-neutral-500 uppercase dark:text-neutral-400">
              {t('careers.investors')}
            </h2>
            <div className="mt-8 grid w-full grid-cols-3 items-start justify-start gap-10">
              {['y-combinator', 'accel', 'softbank'].map(name => (
                <div key={name} className="relative h-10">
                  <img
                    src={`/marketing/logos/${name}.png`}
                    alt={name}
                    className="absolute inset-0 h-6 w-full object-contain dark:invert dark:filter"
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          </div>
          {/* 右侧精选岗位 */}
          <div className="divide-divide border-divide flex flex-col items-center justify-center divide-y">
            {careers.slice(0, 3).map(career => (
              <a
                href={career.href}
                key={career.id}
                className="block cursor-pointer px-4 py-4 hover:bg-gray-100 md:px-8 dark:hover:bg-neutral-800"
              >
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                  <h3 className="text-brand font-medium">{career.title}</h3>
                  <div className="hidden size-1 rounded-full bg-gray-400 sm:block dark:bg-neutral-600" />
                  <p className="text-sm text-gray-600 dark:text-neutral-400">{career.location}</p>
                  <div className="hidden size-1 rounded-full bg-gray-400 sm:block dark:bg-neutral-600" />
                  <span className="text-xs font-medium text-gray-600 dark:text-neutral-400">
                    {Math.floor((new Date().getTime() - new Date(career.createdAt).getTime()) / (1000 * 60 * 60 * 24))}{' '}
                    {t('careers.daysAgo')}
                  </span>
                </div>
                <p className="mt-2 font-medium text-neutral-500 dark:text-neutral-200">{career.description}</p>
              </a>
            ))}
          </div>
        </div>
      </Container>

      {/* 媒体报道 + 团队照片 */}
      <Container className="border-divide border-x border-b px-4 pb-20 md:px-8">
        <div className="flex w-full flex-col items-center py-10 md:py-20 lg:flex-row">
          <h2 className="mb-4 min-w-40 text-center font-mono text-sm tracking-tight text-neutral-500 uppercase lg:mb-0 lg:text-left dark:text-neutral-400">
            {t('careers.featuredIn')}
          </h2>
          <div className="grid w-full grid-cols-2 items-center gap-4 md:grid-cols-4">
            {['bloomberg', 'wired', 'forbes', 'the-guardian'].map(name => (
              <img
                key={name}
                src={`/marketing/logos/${name}.png`}
                alt={name}
                className="h-6 w-full object-contain dark:invert dark:filter"
                draggable={false}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-8">
          {teamImages.map(image => (
            <ScalesContainer className={cn('h-80 w-full', image.className)} key={image.src}>
              <img
                src={image.src}
                alt="Team"
                className={cn('h-80 w-full rounded-2xl object-cover object-top', image.className)}
                draggable={false}
              />
            </ScalesContainer>
          ))}
        </div>
      </Container>

      {/* 岗位列表 */}
      <Container className="border-divide flex flex-col items-center border-x border-b py-16 pb-20">
        <Badge text={t('careers.openRolesBadge')} />
        <SectionHeading className="mt-4 px-4 text-center">{t('careers.openRolesTitle')}</SectionHeading>
        <div className="mt-12 w-full">
          {uniqueDepartments.map(department => (
            <JobSection key={department} title={department} jobs={careers.filter(c => c.department === department)} />
          ))}
        </div>
      </Container>

      {/* 为什么加入 */}
      <Container className="border-divide flex flex-col items-center border-x border-b py-16 pb-20">
        <Badge text={t('careers.goalsBadge')} />
        <SectionHeading className="mt-4 px-4 text-center">{t('careers.goalsTitle')}</SectionHeading>
        <div className="mt-12 grid grid-cols-1 gap-10 px-4 md:grid-cols-2 md:px-8 lg:grid-cols-3">
          {why.map(item => (
            <div
              key={item.title}
              className="relative z-10 rounded-lg bg-gray-50 p-4 transition duration-200 md:p-5 dark:bg-neutral-800"
            >
              <div className="flex items-center gap-2">{item.icon}</div>
              <h3 className="mt-4 mb-2 text-lg font-medium">{item.title}</h3>
              <p className="text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* 底部 CTA */}
      <CTA />
      <DivideX />
    </>
  )
}

function Row({ job, index }: { job: (typeof careers)[0]; index: number }) {
  return (
    <a
      href={job.href}
      className="group flex flex-col px-4 py-4 hover:bg-gray-100 md:flex-row md:items-center md:justify-between md:px-8 dark:hover:bg-neutral-800"
    >
      <div className="flex items-center gap-6">
        <span className="group-hover:text-brand font-mono text-sm text-gray-500 dark:text-neutral-400">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3 className="text-charcoal-700 text-lg font-medium dark:text-neutral-100">{job.title}</h3>
      </div>
      <div className="flex items-center gap-2 pl-10 md:pl-0">
        <p className="text-sm text-gray-600 dark:text-neutral-400">{job.location}</p>
        <svg
          className="group-hover:text-brand hidden h-5 w-5 text-gray-400 transition duration-200 group-hover:translate-x-1 md:block"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </a>
  )
}

function JobSection({ title, jobs }: { title: string; jobs: typeof careers }) {
  return (
    <div className="border-divide mb-12 border-b">
      <h2 className="text-charcoal-700 bg-gray-50 px-4 py-4 text-xl font-semibold md:px-8 dark:bg-neutral-800 dark:text-neutral-100">
        {title}
      </h2>
      <div className="divide-divide divide-y">
        {jobs.map((job, index) => (
          <Row key={job.id} job={job} index={index} />
        ))}
      </div>
    </div>
  )
}
