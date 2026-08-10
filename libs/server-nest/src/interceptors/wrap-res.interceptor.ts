import { CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

import { catchError, Observable, throwError } from 'rxjs'
import { map } from 'rxjs/operators'

import { IDataRes } from '@libs/payload'

import { SKIP_WRAP_RES } from '../decorators'
import { ExceptionResponse } from '../exception'

export class WrapResInterceptor<T> implements NestInterceptor<T, IDataRes<T> | T> {
  private readonly logger = new Logger(WrapResInterceptor.name)

  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<IDataRes<T> | T> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_WRAP_RES, [context.getHandler(), context.getClass()])

    if (skip) {
      return next.handle()
    }

    return next.handle().pipe(
      map(data => ({
        code: 0,
        msg: 'ok',
        data
      })),
      catchError(error => {
        if (!(error instanceof ExceptionResponse)) {
          this.logger.error(error.message, error.stack)
        }
        return throwError(() => error)
      })
    )
  }
}
