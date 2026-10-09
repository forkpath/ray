import { ApiClientProvider } from '@libs/api-client'

import { apiClient } from '~/lib/api'
import { QueryClientProvider } from '~/lib/query'

import { AnalyticsProvider } from './analytics'
import { I18nProvider } from './i18n'
import { MonitoringProvider } from './monitoring'

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <QueryClientProvider>
      <ApiClientProvider client={apiClient}>
        <I18nProvider>
          <AnalyticsProvider>
            <MonitoringProvider>{children}</MonitoringProvider>
          </AnalyticsProvider>
        </I18nProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  )
}
