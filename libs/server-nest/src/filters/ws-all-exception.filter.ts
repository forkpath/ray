import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'

import { WebSocket } from 'ws'

@Catch()
export class WebSocketAllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(WebSocketAllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToWs()
    const client = ctx.getClient() as WebSocket

    let errorMessage: string
    let errorCode: number

    if (exception instanceof WsException) {
      errorMessage = exception.message
      errorCode = 200
    } else if (exception instanceof Error) {
      errorMessage = exception.message
      errorCode = 500
    } else {
      errorMessage = 'Internal server error'
      errorCode = 500
    }

    this.logger.error(`WebSocket Error: ${errorCode}, Error Message: ${errorMessage}`)

    // 返回异常给到客户端
    if (client.readyState === WebSocket.OPEN) {
      const errorPayload = JSON.stringify({ code: errorCode, msg: errorMessage })
      client.send(errorPayload)
    }
  }
}
