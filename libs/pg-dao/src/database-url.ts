export const POSTGRES_DATABASE_URL = 'POSTGRES_DATABASE_URL'
export const LEGACY_POSTGRES_DATABASE_URL = 'POSGTRES_DATABASE_URL'

export interface PostgresDatabaseEnvironment {
  readonly POSTGRES_DATABASE_URL?: string
  readonly POSGTRES_DATABASE_URL?: string
}

export interface ResolvePostgresDatabaseUrlOptions {
  readonly warn?: (message: string) => void
}

function validateDatabaseUrl(variableName: string, value: string): string {
  try {
    new URL(value)
  } catch {
    throw new Error(`${variableName} must be a valid URL.`)
  }

  return value
}

export function createPostgresDatabaseUrlResolver() {
  let legacyWarningEmitted = false

  return (environment: PostgresDatabaseEnvironment, options: ResolvePostgresDatabaseUrlOptions = {}): string => {
    const preferredUrl = environment.POSTGRES_DATABASE_URL?.trim()
    if (preferredUrl) {
      return validateDatabaseUrl(POSTGRES_DATABASE_URL, preferredUrl)
    }

    const legacyUrl = environment.POSGTRES_DATABASE_URL?.trim()
    if (legacyUrl) {
      const validatedLegacyUrl = validateDatabaseUrl(LEGACY_POSTGRES_DATABASE_URL, legacyUrl)

      if (!legacyWarningEmitted) {
        const warn = options.warn ?? console.warn
        warn(
          `${LEGACY_POSTGRES_DATABASE_URL} is deprecated; use ${POSTGRES_DATABASE_URL}. ` +
            'Legacy fallback will be removed after two successful production releases.'
        )
        legacyWarningEmitted = true
      }

      return validatedLegacyUrl
    }

    throw new Error(
      `${POSTGRES_DATABASE_URL} is required. ` +
        `${LEGACY_POSTGRES_DATABASE_URL} is accepted only as a temporary fallback.`
    )
  }
}

export const resolvePostgresDatabaseUrl = createPostgresDatabaseUrlResolver()
