import { describe, expect, it } from 'vitest'

import { desiredState, ORG_SCOPES } from '../config'

describe('desiredState', () => {
  it('declares one application per ray platform', () => {
    const names = desiredState.applications.map(a => a.name)
    expect(names).toEqual(expect.arrayContaining(['ray-web', 'ray-mobile', 'ray-desktop', 'ray-extension']))
  })

  it('maps org roles to subsystem access scopes', () => {
    const dev = desiredState.organizationTemplate.roles.find(r => r.name === 'developer')
    expect(dev?.scopes).toContain('access:crm')
    expect(dev?.scopes).toContain('access:dashboard')
  })

  it('every role scope is declared in the template scope set', () => {
    const allowed = new Set(ORG_SCOPES)
    for (const role of desiredState.organizationTemplate.roles) {
      for (const scope of role.scopes) {
        expect(allowed.has(scope)).toBe(true)
      }
    }
  })
})
