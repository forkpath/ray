/**
 * Normalize Better Auth permission results across fetch configurations.
 * UI authorization is fail-closed when the response is malformed.
 */
export const resolvePermissionCheckSuccess = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value
  }

  if (!value || typeof value !== 'object') {
    return false
  }

  const parsed = value as {
    success?: unknown
    data?: {
      success?: unknown
    }
  }

  if (typeof parsed.success === 'boolean') {
    return parsed.success
  }

  if (typeof parsed.data?.success === 'boolean') {
    return parsed.data.success
  }

  return false
}
