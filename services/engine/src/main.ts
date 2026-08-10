import './instrument'

import type { ServerConfig } from '@libs/server-kernel'

import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'

import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'

import { LoggerService } from '@libs/srv-shared'

import { AppModule } from './app.module'

async function bootstrap() {
  //设置为true以确保所有日志都将被缓冲，直到连接自定义日志服务
  /**
   * bodyParser 配置用于控制 NestJS 是否自动注册全局的 body 解析中间件（如 express.json(), express.urlencoded()）。
   * 设置为 false 时，NestJS 不会自动加载 bodyParser，需要手动按需引入自己所需的 body 处理中间件。
   *
   * 注意，禁用 bodyParser 后，若业务逻辑依赖 req.body（即 JSON/form-data 等），
   * 需要自己按需配置解析中间件，否则 req.body 会是 undefined。
   */
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false })

  // see https://expressjs.com/en/guide/behind-proxies.html
  // 位于代理后面（后面限流操作需要判断）
  app.set('trust proxy', true)

  // 使用自定义日志服务
  const logger = app.get(LoggerService)
  app.useLogger(logger)

  const globalPrefix = 'api/v1'
  app.setGlobalPrefix(globalPrefix)

  app.use(`/${globalPrefix}/billing/webhook/stripe`, express.raw({ type: 'application/json' }))
  app.use(`/${globalPrefix}/billing/webhook/revenuecat`, express.raw({ type: 'application/json' }))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  const configService = app.get(ConfigService)
  const { enginePort, corsOrigins } = configService.get('server') as ServerConfig

  /**
   * 当 credentials: true 时，不能设置 origin: '*'
   * 而且，当credentials为true，就意味着允许origin前端携带认证信息（cookie、Authorization header、TLS client cert）跨域访问API
   * Access-Control-Allow-Credentials: true
   * 当credentials为true之后，只要前端请求带有Authorization等非简单headers等自定义请求头，就会触发CORS预检请求（OPTIONS)
   * 所以当credentials为true时，建议根据实际headers的使用来配置allowedHeaders和methods
   */
  if (corsOrigins !== '*') {
    const origin = corsOrigins.split(',').map(item => item.trim())

    app.enableCors({
      origin,
      credentials: true,
      allowedHeaders: '*', // 严格一点可以是['Authorization', 'Content-Type', 'X-Custom-Header'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    })
  }

  // 使用 helmet 中间件增强安全性，禁用 crossOriginEmbedderPolicy 以允许跨源嵌入资源，避免XSS
  app.use(helmet({ crossOriginEmbedderPolicy: false }))

  app.use(cookieParser())

  /**
   * NestJS 默认 不会触发 onModuleDestroy() / onApplicationShutdown() 这些生命周期钩子
   * 启用这个后：
   * NestJS 会监听以下系统信号：
   * SIGINT（如 Ctrl+C）
   * SIGTERM（容器停止）
   * SIGQUIT
   * 然后自动调用你实现的生命周期钩子：
   * @Injectable()
   * export class MyService implements OnApplicationShutdown {
   *   onApplicationShutdown(signal: string) {
   *     console.log(`App shutting down due to ${signal}`);
   *     // 清理连接、资源释放等
   *   }
   * }
   */
  app.enableShutdownHooks()

  app
    .listen(enginePort)
    .then(() => {
      logger.log(`🚀 Engine is running on: http://localhost:${enginePort}/${globalPrefix}`)
    })
    .catch(err => {
      logger.error(`🪰 Engine start failed: ${err}`)
      process.exit(1)
    })
}

bootstrap()
  .then(() => console.log('Press Ctrl + C to stop the server'))
  .catch(err => console.error(err))
