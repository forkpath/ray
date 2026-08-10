import { describe, expect, it, vi } from 'vitest'

import { createPostgresDatabaseUrlResolver } from './database-url'

describe('PostgreSQL database URL compatibility', () => {
  it('prefers the correctly spelled variable without warning', () => {
    const warn = vi.fn()
    const resolve = createPostgresDatabaseUrlResolver()

    expect(
      resolve(
        {
          POSTGRES_DATABASE_URL: 'postgresql://preferred/database',
          POSGTRES_DATABASE_URL: 'postgresql://legacy/database'
        },
        { warn }
      )
    ).toBe('postgresql://preferred/database')
    expect(warn).not.toHaveBeenCalled()
  })

  it('ignores an invalid legacy value when the preferred variable is valid', () => {
    const resolve = createPostgresDatabaseUrlResolver()

    expect(
      resolve({
        POSTGRES_DATABASE_URL: 'postgresql://preferred/database',
        POSGTRES_DATABASE_URL: 'not a URL'
      })
    ).toBe('postgresql://preferred/database')
  })

  it('uses the legacy variable and emits its deprecation warning once', () => {
    const warn = vi.fn()
    const resolve = createPostgresDatabaseUrlResolver()
    const environment = {
      POSGTRES_DATABASE_URL: 'postgresql://legacy/database'
    }

    expect(resolve(environment, { warn })).toBe('postgresql://legacy/database')
    expect(resolve(environment, { warn })).toBe('postgresql://legacy/database')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('POSGTRES_DATABASE_URL is deprecated'))
  })

  it('fails when neither variable is configured', () => {
    const resolve = createPostgresDatabaseUrlResolver()

    expect(() => resolve({})).toThrow(/POSTGRES_DATABASE_URL is required/)
  })

  it('fails when the selected variable is not a valid URL', () => {
    const warn = vi.fn()
    const resolve = createPostgresDatabaseUrlResolver()

    expect(() => resolve({ POSGTRES_DATABASE_URL: 'not a URL' }, { warn })).toThrow(
      /POSGTRES_DATABASE_URL must be a valid URL/
    )
    expect(warn).not.toHaveBeenCalled()
  })
})
