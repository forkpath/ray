export type TenantStatus = 'pending' | 'active' | 'failed' | 'deprovisioned'

export type TenantTier = 'dedicated' | 'shared'

export interface TenantRecord {
  orgId: string
  name: string
  dbName: string | null
  domain: string | null
  tier: TenantTier
  status: TenantStatus
  kongServiceId: string | null
  kongRouteId: string | null
}

export interface TenantRegistry {
  upsert: (record: TenantRecord) => Promise<void>
  get: (orgId: string) => Promise<TenantRecord | null>
  list: () => Promise<TenantRecord[]>
  setStatus: (orgId: string, status: TenantStatus) => Promise<void>
}

export interface OrganizationProvisioner {
  createOrganization: (input: { name: string }) => Promise<{ id: string }>
  addUser: (orgId: string, userId: string) => Promise<void>
  assignRole: (orgId: string, userId: string, role: string) => Promise<void>
  deleteOrganization: (orgId: string) => Promise<void>
}

export interface DatabaseProvisioner {
  provisionDatabase: (orgId: string) => Promise<{ dbName: string; databaseUrl: string }>
  deprovisionDatabase: (orgId: string) => Promise<void>
}

export interface SubsystemMigrator {
  migrate: (databaseUrl: string) => Promise<void>
}

export interface RouterProvisioner {
  createTenantRoute: (input: {
    orgId: string
    domain: string
    upstreamUrl: string
  }) => Promise<{ serviceId: string; routeId: string }>
  deleteTenantRoute: (ids: { serviceId: string; routeId: string }) => Promise<void>
}

export interface Deployer {
  deploy: (orgId: string, manifestPath: string) => Promise<void>
  teardown: (orgId: string) => Promise<void>
}
