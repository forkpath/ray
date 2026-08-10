import type { I18nPath } from '../i18n'

import { HttpException, HttpStatus } from '@nestjs/common'

export class ExceptionResponse extends HttpException {
  constructor(
    public readonly key: I18nPath,
    public readonly args: Record<string, unknown>,
    status = HttpStatus.INTERNAL_SERVER_ERROR
  ) {
    super({ key, args }, status)
  }
}

export class InvalidValueObjectException extends ExceptionResponse {
  constructor(key: I18nPath) {
    super(key, {}, HttpStatus.BAD_REQUEST)
  }
}

// 类似于exp这些key全部定义在了i18n中
export class ForbiddenException extends ExceptionResponse {
  constructor(key: I18nPath) {
    super(key, {}, HttpStatus.FORBIDDEN)
  }
}

export class AuthenticationException extends ExceptionResponse {
  constructor() {
    super('auth.error.authenticationFailed', {}, HttpStatus.UNAUTHORIZED)
  }
}

export class EntityAlreadyExistsException extends ExceptionResponse {
  constructor(key: I18nPath, args?: Record<string, unknown>) {
    super(key, args || {}, HttpStatus.CONFLICT)
  }
}

export class EntityNotFoundException extends ExceptionResponse {
  constructor(key: I18nPath, args?: Record<string, unknown>) {
    super(key, args || {}, HttpStatus.NOT_FOUND)
  }
}
