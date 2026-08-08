/**
 * 标识符安全校验。
 *
 * orgId / 库名 / 域名片段会被拼接进 SQL DDL、Kong tag、URL、文件路径，
 * 必须先经白名单校验，杜绝注入与路径穿越。DDL 无法参数化，这是唯一防线。
 */

const ORG_ID_RE = /^[a-z0-9][a-z0-9_-]{1,62}$/
const DB_NAME_RE = /^[a-z][a-z0-9_]{1,62}$/
const DOMAIN_LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

export class UnsafeIdentifierError extends Error {
  constructor(kind: string, value: string) {
    super(`Unsafe ${kind}: ${JSON.stringify(value)}`)
    this.name = 'UnsafeIdentifierError'
  }
}

/** 校验 orgId：小写字母数字、连字符、下划线，2–63 长度，首字符为字母数字。 */
export function assertSafeOrgId(orgId: string): string {
  if (typeof orgId !== 'string' || !ORG_ID_RE.test(orgId)) {
    throw new UnsafeIdentifierError('orgId', String(orgId))
  }
  return orgId
}

/** 由 orgId 推导 Postgres 业务库名，并校验最终库名安全。 */
export function tenantDbName(orgId: string): string {
  assertSafeOrgId(orgId)
  // orgId 可能含连字符，库名转下划线以符合 Postgres 习惯标识符
  const name = `tenant_${orgId.replace(/-/g, '_')}`.toLowerCase()
  if (!DB_NAME_RE.test(name)) throw new UnsafeIdentifierError('dbName', name)
  return name
}

/** 校验单个域名 label（子域），防止路径穿越/注入到 Kong/文件名。 */
export function assertSafeDomainLabel(label: string): string {
  if (typeof label !== 'string' || !DOMAIN_LABEL_RE.test(label)) {
    throw new UnsafeIdentifierError('domainLabel', String(label))
  }
  return label
}
