import { BadRequestException, HttpStatus, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core'
import { CqrsModule } from '@nestjs/cqrs'
import { ScheduleModule } from '@nestjs/schedule'

import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup'
import { I18nService } from 'nestjs-i18n'
import { createZodValidationPipe } from 'nestjs-zod'
import { ZodError } from 'zod'

import { auth } from '@libs/auth-server'
import { MongoDaoModule } from '@libs/mongo-dao'
import { PgDaoModule } from '@libs/pg-dao'
import { AllExceptionsFilter, AppConfig, I18nModule, WrapResInterceptor } from '@libs/server-nest'
import { RedisModule } from '@libs/server-redis'
import { AuthModule, CacheModule, LoggerModule, RabbitmqModule, ThrottlerModule } from '@libs/srv-shared'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { BillingModule } from './presentation/http/billing/billing.module'
import { CustomerModule } from './presentation/http/customer/customer.module'
import { OrganizationModule } from './presentation/http/organization/organization.module'
import { StorageModule } from './presentation/http/storage/storage.module'
import { UserModule } from './presentation/http/user/user.module'

@Module({
  imports: [
    // Sentry 性能追踪 & 异常上报（需在其他业务模块之前）
    SentryModule.forRoot(),

    // Config，需要保证全局可用，且需要优先于其他模块加载
    ConfigModule.forRoot({
      isGlobal: true,
      load: [AppConfig]
    }),

    /** 认证鉴权模块
     * 默认该模块中使用AuthGuard来进行全局认证鉴权
     * 可以手动关掉disableGlobalAuthGuard: true,
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AuthModule.forRoot({ auth: auth as any }),

    // 日志模块
    LoggerModule.register('portal'),

    // 缓存模块
    CacheModule.register(),

    // 定时任务 Cron
    ScheduleModule.forRoot(),

    // 国际化模块
    I18nModule.register(),

    // Redis全局可访问
    RedisModule.register(),

    /*
     * 根据需要，建议在具体的应用中去加载这些模块
     * 对象存储模块 StorageModule.register(),
     * 短信发送模块 SmsModule.register(),
     * 邮件收发模块 EmailModule.register(),
     * 消息队列模块 RabbitmqModule.register(),
     * 限流模块 ThrottlerModule.register(),
     * mongoDB模块 MongoDaoModule.forRoot()
     */

    // ORM模块
    PgDaoModule.register(),

    // 限流模块
    ThrottlerModule.register(),

    // MongoDB 连接只在应用根层建立一次；具体 DAO provider 由业务模块按需导入 forFeature。
    MongoDaoModule.forRoot(),

    // RabbitMQ job dispatch；worker 消费消息，engine 只发布轻量引用。
    RabbitmqModule.register(),

    // CQRS 模块
    CqrsModule,

    // 业务模块
    BillingModule,
    UserModule,
    OrganizationModule,
    CustomerModule,
    StorageModule
  ],
  controllers: [AppController],
  providers: [
    /* 配置全局拦截器
     * WrapResInterceptor 统一响应格式拦截器，将返回数据包装成固定格式
     * 例如: { code: 0, msg: 'ok', data: 原始数据 }，其中 code 和 msg 是固定的
     *
     * ClassSerialInterceptor 统一序列化拦截器，使用 class-transformer 序列化对象
     * 例如：class UserDto { @Expose() id: number; password: string; }
     * 序列化后只会返回 { id: 1 }，不会返回 password
     * strategy: 'excludeAll' 默认排除所有属性，只有被 @Expose() 装饰的属性才会被序列化
     * excludeExtraneousValues: true  排除未在类中定义的额外属性
     */
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) => new WrapResInterceptor(reflector),
      inject: [Reflector]
    },
    // 配置全局管道，使用nestjs-zod进行数据校验，而不是采用class-validator，这样可以服用libs中的schema定义，保证前后端有统一的校验约束
    {
      provide: APP_PIPE,
      useFactory: (i18n: I18nService) =>
        createZodValidationPipe({
          // 将ZodError -> Nest异常 + i18n的翻译
          createValidationException: (error: unknown) => {
            const zodError = error as ZodError
            // 1. 把每条issue映射成特定的返回格式
            const translatedIssues = zodError.issues.map(issue => ({
              path: issue.path.join('.'),
              code: issue.code,
              message: i18n.t(issue.message, {
                defaultValue: issue.message
              })
            }))

            return new BadRequestException({
              statusCode: HttpStatus.BAD_REQUEST,
              message: i18n.t('dto.validataion.failed'),
              errors: translatedIssues
            })
          }
        }),
      inject: [I18nService]
    },

    /* 配置全局异常过滤器
     * 注意：过滤器的执行顺序很重要，最后注册的过滤器（）会先被调用，执行顺序是从后到前
     * providers: [
     *   {
     *     provide: APP_FILTER,
     *     useClass: FilterA
     *   },
     *   {
     *     provide: APP_FILTER,
     *     useClass: FilterB
     *   }
     * ]
     * 最终执行顺序是 FilterB -> FilterA
     */
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter
    },
    AppService
  ]
})
export class AppModule {}
