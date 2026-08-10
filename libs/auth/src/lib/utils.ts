import { getOrigin, mergeSearchParams } from '@libs/common'

export {
  generateName,
  getAllRolesAtOrAbove,
  getAllRolesAtOrBelow,
  hasAdminPermission,
  hasOrgAdminPermission,
  toMemberRole
} from '@libs/auth-contract'

export const getUrl = ({ request, url, type }: { request?: Request; url?: string; type?: string }) => {
  const passedUrl = request?.headers.get('x-url')
  const expoOrigin = request?.headers.get('expo-origin')

  let resultUrl: URL

  if (passedUrl) {
    // Base on x-url; merge in params from provided `url` without overwriting existing keys
    resultUrl = new URL(passedUrl)
    if (url) {
      const urlObj = new URL(url, getOrigin(resultUrl.toString()) ?? expoOrigin ?? undefined)
      mergeSearchParams(resultUrl, urlObj, { overwrite: false })
    }
  } else if (expoOrigin) {
    // For Expo/mobile, base on expo-origin; if `url` has a query, adopt it entirely
    resultUrl = new URL(expoOrigin)
    if (url) {
      const targetUrl = new URL(url)
      if (targetUrl.search) {
        mergeSearchParams(resultUrl, targetUrl, { replace: true })
      }
    }
  } else {
    // For web, use the provided URL or fall back to the request URL
    resultUrl = new URL(url ?? request?.url ?? '')
  }

  if (type) {
    resultUrl.searchParams.set('type', type)
  }

  return resultUrl
}
