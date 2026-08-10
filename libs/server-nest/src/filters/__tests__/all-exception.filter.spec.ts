import type { ArgumentsHost } from '@nestjs/common'

import { describe, expect, it, vi } from 'vitest'

import { AllExceptionsFilter } from '../all-exception.filter'

vi.mock('@libs/monitoring/server', () => ({
  captureException: vi.fn()
}))

describe('AllExceptionsFilter', () => {
  it('translates domain exceptions without depending on engine classes', () => {
    const i18n = {
      t: vi.fn().mockReturnValue('translated user not found')
    }
    const response = {
      headersSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    }
    const request = {
      headers: { 'accept-language': 'zh' },
      method: 'GET',
      url: '/api/v1/admin/users/missing'
    }
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request
      })
    } as unknown as ArgumentsHost
    const exception = new Error('fallback message') as Error & {
      readonly i18nKey: string
      readonly httpStatus: number
      readonly args: Record<string, unknown>
    }
    Object.assign(exception, {
      i18nKey: 'user.error.userNotFound',
      httpStatus: 404,
      args: { userId: 'missing' }
    })
    const filter = new AllExceptionsFilter(i18n as never)

    filter.catch(exception, host)

    expect(i18n.t).toHaveBeenCalledWith('user.error.userNotFound', {
      lang: 'zh',
      args: { userId: 'missing' }
    })
    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.json).toHaveBeenCalledWith({
      code: 404,
      msg: 'translated user not found'
    })
  })
})
