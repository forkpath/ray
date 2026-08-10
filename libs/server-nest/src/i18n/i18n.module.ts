import path from 'node:path'
import type { I18nConfig } from '@libs/server-kernel'

import { DynamicModule, Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AcceptLanguageResolver, I18nJsonLoader, I18nModule as NestI18nModule } from 'nestjs-i18n'

@Module({})
export class I18nModule {
  private static readonly logger = new Logger('I18nModule')

  static register(): DynamicModule {
    return {
      module: I18nModule,
      imports: [
        NestI18nModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const { fallbackLng, localePath } = configService.get<I18nConfig>('i18n') as I18nConfig
            const resolvedPath = path.join(process.cwd(), localePath)
            const typesPath = path.join(process.cwd(), 'libs/server-nest/src/i18n/i18n.types.ts')

            this.logger.log(`Loading translations from: ${resolvedPath}`)
            this.logger.log(`Types will be generated to: ${typesPath}`)

            return {
              fallbackLanguage: fallbackLng,
              // 显式指定 JSON Loader
              loader: I18nJsonLoader,
              loaderOptions: {
                // 使用项目根目录作为基础路径，支持前后端共用翻译文件
                path: resolvedPath,
                // 启用文件监听，文件变化时自动重新加载
                watch: true,
                // 包含子文件夹（如 en/, zh/ 等）
                includeSubfolders: true
              },
              // 类型输出路径 - 应用启动时自动生成
              typesOutputPath: typesPath,
              // 开启日志便于调试
              logging: true
            }
          },
          resolvers: [AcceptLanguageResolver]
        })
      ],
      exports: [NestI18nModule]
    }
  }
}
