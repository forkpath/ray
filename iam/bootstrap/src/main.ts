/**
 * 配置即代码入口：把 desiredState 幂等同步到 Logto。
 *
 * 运行：pnpm bootstrap （需 iam/.env 提供 LOGTO_* 凭据）
 * 二次运行应全部 skipped（幂等）。
 */
import { desiredState } from './config'
import { ManagementClient } from './management-client'
import { reconcile } from './reconcile'

async function main(): Promise<void> {
  const endpoint = process.env.LOGTO_ENDPOINT
  const m2mId = process.env.LOGTO_M2M_APP_ID
  const m2mSecret = process.env.LOGTO_M2M_APP_SECRET
  if (!endpoint || !m2mId || !m2mSecret) {
    throw new Error('Missing LOGTO_ENDPOINT / LOGTO_M2M_APP_ID / LOGTO_M2M_APP_SECRET')
  }
  const client = new ManagementClient({ endpoint, m2mId, m2mSecret })

  // 1. API resources
  const apiResources = await reconcile(
    {
      list: () => client.api<Array<{ indicator: string }>>('/resources'),
      create: r => client.api<{ id: string }>('/resources', 'POST', r)
    },
    desiredState.apiResources,
    d => d.indicator,
    e => e.indicator
  )

  // 2. Applications
  const applications = await reconcile(
    {
      list: () => client.api<Array<{ name: string }>>('/applications'),
      create: a =>
        client.api<{ id: string }>('/applications', 'POST', {
          name: a.name,
          type: a.type,
          oidcClientMetadata: { redirectUris: a.redirectUris, postLogoutRedirectUris: [] }
        })
    },
    desiredState.applications,
    d => d.name,
    e => e.name
  )

  // 3. Organization scopes
  const scopes = await reconcile(
    {
      list: () => client.api<Array<{ name: string }>>('/organization-scopes'),
      create: name => client.api<{ id: string }>('/organization-scopes', 'POST', { name })
    },
    [...desiredState.organizationTemplate.scopes],
    d => d,
    e => e.name
  )

  // 4. Organization roles
  const roles = await reconcile(
    {
      list: () => client.api<Array<{ name: string }>>('/organization-roles'),
      create: r => client.api<{ id: string }>('/organization-roles', 'POST', { name: r.name })
    },
    desiredState.organizationTemplate.roles,
    d => d.name,
    e => e.name
  )

  console.log(JSON.stringify({ apiResources, applications, scopes, roles }, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
