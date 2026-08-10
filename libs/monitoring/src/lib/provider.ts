import type { MonitoringProviderName, MonitoringProviderStrategy, MonitoringServerStrategy } from './types'

import { MonitoringProvider } from './types'

const clientNoop: MonitoringProviderStrategy = {
  Provider: ({ children }) => children,
  captureException: () => undefined,
  identify: () => undefined,
  initialize: () => undefined
}

const serverNoop: MonitoringServerStrategy = {
  captureException: () => undefined,
  initialize: () => undefined
}

export function normalizeMonitoringProvider(value: string | undefined): MonitoringProviderName {
  return value === MonitoringProvider.SENTRY ? MonitoringProvider.SENTRY : MonitoringProvider.POSTHOG
}

export function selectMonitoringClientStrategy(
  provider: string | undefined,
  strategies: Partial<Record<MonitoringProviderName, MonitoringProviderStrategy>>
): MonitoringProviderStrategy {
  return strategies[normalizeMonitoringProvider(provider)] ?? clientNoop
}

export function selectMonitoringServerStrategy(
  provider: string | undefined,
  strategies: Partial<Record<MonitoringProviderName, MonitoringServerStrategy>>
): MonitoringServerStrategy {
  return strategies[normalizeMonitoringProvider(provider)] ?? serverNoop
}
