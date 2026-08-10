import type { AuthErrorCode } from '@libs/auth-contract'
import type { TFunction } from 'i18next'

import { ERROR_MESSAGES } from '@libs/auth-contract'

/**
 * 从 Better Auth 抛出的错误中提取用户可读的、已翻译的错误消息。
 *
 * 优先使用 error.code 查找 i18n 翻译，回退到 error.message，
 * 最终回退到通用错误提示。
 */
export function getAuthErrorMessage(error: unknown, t: TFunction): string {
  if (!error || typeof error !== 'object') {
    return t('auth:error.unknown', { defaultValue: 'Something went wrong' })
  }

  const err = error as { code?: string; message?: string }

  if (err.code && err.code in ERROR_MESSAGES) {
    const key = ERROR_MESSAGES[err.code as AuthErrorCode]
    return t(key, { defaultValue: err.message ?? 'Something went wrong' })
  }

  if (err.message) {
    return err.message
  }

  return t('auth:error.unknown', { defaultValue: 'Something went wrong' })
}
