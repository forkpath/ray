import type { PropsWithChildren } from 'react'

import { Container, Font, Head, Html, Section, Tailwind } from '@react-email/components'
import { formatHex, oklch } from 'culori'
import { default as mapValues } from 'lodash/mapValues'

import { ThemeMode, themes } from '@libs/ui-core'

import { Footer } from './footer'
import { Header } from './header'

const variables = themes['orange'][ThemeMode.LIGHT]
const colors = mapValues(variables, ([l, c, h, alpha]) =>
  formatHex(
    oklch({
      mode: 'oklch',
      l,
      c,
      h,
      alpha
    })
  )
)

export const Layout = ({
  children,
  origin,
  locale
}: PropsWithChildren<{ origin?: string | null; locale?: string }>) => {
  return (
    <Html lang={locale}>
      <Head>
        <Font
          fontFamily="Geist"
          fallbackFontFamily="Arial"
          fontWeight={400}
          fontStyle="normal"
          webFont={{
            url: 'https://fonts.gstatic.com/s/geist/v3/gyByhwUxId8gMEwYGFWNOITddY4.woff2',
            format: 'woff2'
          }}
        />
      </Head>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors
            }
          }
        }}
      >
        <Section className="p-1">
          <Container className="bg-card text-card-foreground rounded-lg p-6">
            {origin && <Header origin={origin} />}
            {children}
            {origin && <Footer origin={origin} />}
          </Container>
        </Section>
      </Tailwind>
    </Html>
  )
}
