/// <reference types="vite/client" />
import type { QueryClient } from '@tanstack/react-query'

import * as React from 'react'
import { useEffect } from 'react'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

import { DefaultCatchBoundary } from '~/components/default-catch-boundary'
import { NotFound } from '~/components/not-found'
import { AnalyticsProvider } from '~/lib/providers/analytics'
import { MonitoringProvider } from '~/lib/providers/monitoring'
import { seo } from '~/utils/seo'

import { config, I18nProvider } from '@libs/i18n'
import { ThemeProvider, ThemeScript, Toaster } from '@libs/studio'
import { cn } from '@libs/ui-core'

import appCss from '../styles/app.css?url' // 注意因为试用了?url，所以需要使用相对路径

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  // loader: async () => {
  //   const locale = getLocaleFromCookies() || appConfig.locale;
  //   // 在 SSR 时，初始化服务端 i18n 并存储到缓存中
  //   if (typeof window === 'undefined') {
  //     const serverI18n = await initializeServerI18n({
  //       locale,
  //       defaultLocale: appConfig.locale,
  //     });
  //     setServerI18n(locale, serverI18n);
  //   }
  //   return { locale }
  // },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8'
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1'
      },
      ...seo({
        title: 'TanStack Start | Type-Safe, Client-First, Full-Stack React Framework',
        description: `TanStack Start is a type-safe, client-first, full-stack React framework. `
      })
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png'
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png'
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png'
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' }
    ]
  }),
  errorComponent: props => {
    return <DefaultCatchBoundary {...props} />
  },
  notFoundComponent: () => <NotFound />,
  shellComponent: RootShell,
  component: RootComponent
})

function RootComponent() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      void import('react-grab')
    }
  }, [])
  return (
    <I18nProvider locale={config.defaultLocale} defaultLocale={config.defaultLocale}>
      <MonitoringProvider>
        <AnalyticsProvider>
          <ThemeProvider>
            <Outlet />
            <Toaster />
          </ThemeProvider>
        </AnalyticsProvider>
      </MonitoringProvider>
    </I18nProvider>
  )
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <ThemeScript />
        {import.meta.env.DEV && <script crossOrigin="anonymous" src="//unpkg.com/react-scan/dist/auto.global.js" />}
      </head>
      <body
        suppressHydrationWarning
        className={cn(
          'bg-background text-foreground flex min-h-screen flex-col items-center justify-center font-sans antialiased'
        )}
      >
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right'
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />
            },
            {
              name: 'Tanstack Query',
              render: <ReactQueryDevtoolsPanel />
            }
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
