import { describe, expect, it } from 'vitest'

import { assertSafeDomainLabel, assertSafeOrgId, tenantDbName, UnsafeIdentifierError } from '../identifier'

describe('assertSafeOrgId', () => {
  it('accepts valid ids', () => {
    expect(assertSafeOrgId('acme')).toBe('acme')
    expect(assertSafeOrgId('org-123_x')).toBe('org-123_x')
  })

  it.each([
    'a', // 太短
    'Acme', // 大写
    'acme; DROP DATABASE x', // 注入
    "acme'", // 引号
    '../etc', // 路径穿越
    'org name', // 空格
    '-bad' // 首字符非字母数字
  ])('rejects unsafe id %j', bad => {
    expect(() => assertSafeOrgId(bad)).toThrow(UnsafeIdentifierError)
  })
})

describe('tenantDbName', () => {
  it('derives a safe postgres db name and converts hyphens', () => {
    expect(tenantDbName('acme')).toBe('tenant_acme')
    expect(tenantDbName('org-123')).toBe('tenant_org_123')
  })

  it('rejects malicious orgId before building DDL', () => {
    expect(() => tenantDbName('acme; DROP DATABASE postgres')).toThrow(UnsafeIdentifierError)
  })
})

describe('assertSafeDomainLabel', () => {
  it('accepts valid subdomain labels', () => {
    expect(assertSafeDomainLabel('acme')).toBe('acme')
    expect(assertSafeDomainLabel('acme-corp')).toBe('acme-corp')
  })

  it.each(['Acme', 'a.b', 'acme_', '-acme', 'acme/..'])('rejects %j', bad => {
    expect(() => assertSafeDomainLabel(bad)).toThrow(UnsafeIdentifierError)
  })
})
