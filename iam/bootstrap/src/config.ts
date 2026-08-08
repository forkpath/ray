/**
 * 期望状态（配置即代码）。
 *
 * 这是 Logto 资源的唯一声明来源，reconcile 据此幂等创建：
 * - applications：每个 ray 平台一个 OIDC 客户端
 * - apiResources：受保护的 API 标识
 * - organizationTemplate：组织级粗粒度角色 → scope（= 子系统访问白名单，见 ADR-0002）
 *
 * 注意：organizationTemplate.scopes 必须与 libs/iam/src/server/scopes.ts（Plan 3）保持一致。
 */

export const ORG_SCOPES = ['access:crm', 'access:billing', 'access:dashboard', 'manage:members'] as const

export type OrgScope = (typeof ORG_SCOPES)[number]

export interface DesiredApplication {
  name: string
  type: 'SPA' | 'Native' | 'MachineToMachine'
  redirectUris: string[]
}

export interface DesiredApiResource {
  indicator: string
  name: string
}

export interface DesiredOrgRole {
  name: string
  scopes: OrgScope[]
}

export interface DesiredState {
  apiResources: DesiredApiResource[]
  applications: DesiredApplication[]
  organizationTemplate: {
    scopes: readonly OrgScope[]
    roles: DesiredOrgRole[]
  }
}

export const desiredState: DesiredState = {
  apiResources: [{ indicator: 'https://api.example.com', name: 'ray-api' }],
  applications: [
    { name: 'ray-web', type: 'SPA', redirectUris: ['https://app.example.com/callback'] },
    { name: 'ray-mobile', type: 'Native', redirectUris: ['ray://callback'] },
    { name: 'ray-desktop', type: 'Native', redirectUris: ['ray-desktop://callback'] },
    { name: 'ray-extension', type: 'SPA', redirectUris: ['chrome-extension://*/callback'] }
  ],
  organizationTemplate: {
    scopes: ORG_SCOPES,
    roles: [
      { name: 'org-admin', scopes: ['access:crm', 'access:billing', 'access:dashboard', 'manage:members'] },
      { name: 'developer', scopes: ['access:crm', 'access:dashboard'] },
      { name: 'analyst', scopes: ['access:dashboard'] },
      { name: 'billing-manager', scopes: ['access:billing'] }
    ]
  }
}
