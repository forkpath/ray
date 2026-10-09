import { createFileRoute } from '@tanstack/react-router'

import { useTranslation } from 'react-i18next'

import { Button } from '~/components/marketing/button'
import { Container } from '~/components/marketing/container'
import { Heading } from '~/components/marketing/heading'
import { LogoSVG } from '~/components/marketing/logo'
import { SubHeading } from '~/components/marketing/subheading'

/* 联系我们页面路由 */
export const Route = createFileRoute('/_marketing/contact')({
  head: () => ({
    meta: [
      { title: 'Contact - Ray' },
      {
        name: 'description',
        content: 'Get in touch with the Ray team.'
      }
    ]
  }),
  component: ContactPage
})

function ContactPage() {
  const { t } = useTranslation('marketing')

  return (
    <Container className="min-h-[calc(100vh-8rem)] py-10 pt-32 md:py-20 md:pt-40">
      <div className="grid grid-cols-1 gap-10 px-4 md:grid-cols-2 md:px-8 lg:gap-40">
        <div>
          <LogoSVG />
          <Heading className="mt-4 text-left lg:text-4xl">{t('contact.title')}</Heading>
          <SubHeading as="p" className="mt-4 max-w-xl text-left">
            {t('contact.subtitle')}
          </SubHeading>
          <form className="mt-6 flex flex-col gap-8" onSubmit={e => e.preventDefault()}>
            <div>
              <label className="text-charcoal-700 text-sm font-medium dark:text-neutral-100">
                {t('contact.form.name')}
              </label>
              <input
                type="text"
                className="mt-2 flex h-10 w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-800"
                placeholder={t('contact.form.namePlaceholder')}
              />
            </div>
            <div>
              <label className="text-charcoal-700 text-sm font-medium dark:text-neutral-100">
                {t('contact.form.email')}
              </label>
              <input
                type="email"
                className="mt-2 flex h-10 w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-800"
                placeholder={t('contact.form.emailPlaceholder')}
              />
            </div>
            <div>
              <label className="text-charcoal-700 text-sm font-medium dark:text-neutral-100">
                {t('contact.form.message')}
              </label>
              <textarea
                className="mt-2 flex min-h-[200px] w-full rounded-md border border-gray-200 bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary dark:border-neutral-700 dark:bg-neutral-800"
                placeholder={t('contact.form.messagePlaceholder')}
                rows={10}
              />
            </div>
            <Button>{t('cta.sendMessage')}</Button>
          </form>
        </div>

        {/* 右侧装饰插图 */}
        <div className="relative hidden min-h-80 flex-col items-start justify-end overflow-hidden rounded-2xl bg-black p-4 md:flex md:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-transparent to-primary/10" />
          <div className="relative z-10 max-w-sm rounded-xl bg-black/50 p-4 backdrop-blur-sm">
            <h2 className="text-white">
              Nodus has completely changed how we work. What used to take hours every week is now fully automated.
            </h2>
            <p className="mt-4 text-sm text-white/50">Gina Clinton</p>
            <p className="mt-1 text-sm text-white/50">
              Head of Product, <span className="font-bold">Acme Inc.</span>
            </p>
          </div>
        </div>
      </div>
    </Container>
  )
}
