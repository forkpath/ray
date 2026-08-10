import type { LoggerConfig, LogLevel } from '@libs/server-kernel'

import { DynamicModule, Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { LoggerModule as PinoModule } from 'nestjs-pino'
import { PrettyOptions } from 'pino-pretty'

import { LoggerService } from './logger.service'

interface LogTarget {
  target: string
  options?: PrettyOptions | Record<string, unknown>
  level: LogLevel
}

@Global()
@Module({})
export class LoggerModule {
  static register(scope: string): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoModule.forRootAsync({
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => {
            const config = configService.get<LoggerConfig>('logger')
            const targets: LogTarget[] = []

            // 开发环境下，额外在控制台输出日志
            const isDev = process.env['NODE_ENV'] !== 'production'
            if (isDev) {
              targets.push({
                target: 'pino-pretty',
                level: config?.level as LogLevel,
                options: {
                  colorize: true,
                  translateTime: 'yyyy-mm-dd HH:MM:ss.l',
                  ignore: 'pid,hostname'
                }
              })
            }

            return {
              pinoHttp: {
                transport: {
                  targets
                },
                level: config?.level as LogLevel,
                customProps: req => ({
                  requestId: req.id,
                  context: scope
                })
              }
            }
          }
        })
      ],
      providers: [LoggerService],
      exports: [LoggerService]
    }
  }
}
