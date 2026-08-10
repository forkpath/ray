import fs from 'fs'
import path from 'path'
import type { LoggerConfig, LogLevel } from '@libs/server-kernel'

import { Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { PinoLogger } from 'nestjs-pino'
import pino from 'pino'
import { createStream } from 'rotating-file-stream'

@Injectable()
export class LoggerService implements OnModuleInit {
  private fileLogger: pino.Logger | null = null
  constructor(
    private readonly configService: ConfigService,
    private readonly pinoLogger: PinoLogger
  ) {}

  onModuleInit() {
    const { level, scope, compress, fileEnabled, fileSizeLimit, fileExpiredIn } = this.configService.get<LoggerConfig>(
      'logger'
    ) as LoggerConfig
    const isDev = process.env['NODE_ENV'] !== 'production'

    if (!isDev && fileEnabled) {
      const logDir = path.resolve(process.cwd(), 'logs', scope)
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true })
      }

      const stream = createStream(logDir, {
        size: fileSizeLimit,
        interval: fileExpiredIn,
        compress: compress ? 'gzip' : false,
        path: logDir
      })

      this.fileLogger = pino(
        {
          level,
          timestamp: pino.stdTimeFunctions.isoTime,
          formatters: {
            level: () => ({ level })
          }
        },
        stream
      )
    }
  }

  private logToFile(level: LogLevel, data: Record<string, unknown>) {
    if (!this.fileLogger) return

    switch (level) {
      case 'trace':
        this.fileLogger.trace(data)
        break
      case 'debug':
        this.fileLogger.debug(data)
        break
      case 'info':
        this.fileLogger.info(data)
        break
      case 'warn':
        this.fileLogger.warn(data)
        break
      case 'error':
        this.fileLogger.error(data)
        break
      case 'fatal':
        this.fileLogger.fatal?.(data) // 注意 fatal 可能是插件扩展来的，需小心
        break
      default:
        this.fileLogger.info(data)
        break
    }
  }

  setContext(context: string): this {
    this.pinoLogger.setContext(context)
    // 为了支持chain call
    return this
  }

  verbose(message: string, context?: string) {
    const log = { msg: message, context }
    this.pinoLogger.trace(log)
    this.logToFile('trace', log)
  }

  debug(message: string, context?: string) {
    const log = { msg: message, context }
    this.pinoLogger.debug(log)
    this.logToFile('debug', log)
  }

  log(message: string, context?: string) {
    const log = { msg: message, context }
    this.pinoLogger.info(log)
    this.logToFile('info', log)
  }

  warn(message: string, context?: string) {
    const log = { msg: message, context }
    this.pinoLogger.warn(log)
    this.logToFile('warn', log)
  }

  error(message: string, trace?: string, context?: string) {
    const log = { msg: message, trace, context }
    this.pinoLogger.error(log)
    this.logToFile('error', log)
  }

  fatal(message: string, trace?: string, context?: string) {
    const log = { msg: message, trace, context }
    this.pinoLogger.fatal(log)
    this.logToFile('fatal', log)
  }
}
