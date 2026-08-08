import type { TenantTier } from '../types'

import { assertSafeOrgId } from '../../../shared/src/identifier'

/**
 * 渲染子系统部署清单。
 *
 * - dedicated：渲染独立 compose service，注入 ORG_ID / DATABASE_URL / LOGTO_*。
 * - shared：不渲染独立 service，仅返回 { shared: true } 标记，由共享子系统按
 *   organization_id 在应用内选库。
 *
 * 机密（DATABASE_URL/密钥）以 env 占位输出，由部署机注入，不明文落盘。
 */
export interface RenderManifestInput {
  orgId: string
  tier: TenantTier
  databaseUrlEnvKey: string // 例如 TENANT_acme_DATABASE_URL，由部署机提供
  logto: { endpoint: string; appId: string }
  image: string
}

export type RenderManifestResult = { shared: true } | { shared: false; content: string; serviceName: string }

export function renderManifest(input: RenderManifestInput): RenderManifestResult {
  assertSafeOrgId(input.orgId)

  if (input.tier === 'shared') {
    return { shared: true }
  }

  const serviceName = `sub-${input.orgId}`
  const content = [
    'services:',
    `  ${serviceName}:`,
    `    image: ${input.image}`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      ORG_ID: ${input.orgId}`,
    `      DATABASE_URL: \${${input.databaseUrlEnvKey}}`,
    `      LOGTO_ENDPOINT: ${input.logto.endpoint}`,
    `      LOGTO_APP_ID: ${input.logto.appId}`,
    ''
  ].join('\n')

  return { shared: false, content, serviceName }
}
