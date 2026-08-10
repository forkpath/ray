import type { ElasticsearchConfig } from '@libs/server-kernel'

import { DynamicModule, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch'

/**
 * 对于需要注入的ElasticsearchService模块来说，只需要注册当前这个模块即可，例如：
 * @Module({
 *   imports: [
 *     ElasticsearchModule.register()
 *   ],
 *   controllers: [ResourceController],
 *   providers: [ResourceService]
 * })
 * export class ResourceModule {}
 */
@Module({})
export class ElasticsearchModule {
  static register(): DynamicModule {
    return {
      module: ElasticsearchModule,
      imports: [
        NestElasticsearchModule.registerAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const { host, port, apiKey, maxRetries, requestTimeout } = configService.get<ElasticsearchConfig>(
              'elasticsearch'
            ) as ElasticsearchConfig
            return {
              node: `http://${host}:${port}`,
              auth: {
                apiKey: apiKey
              },
              maxRetries: maxRetries,
              requestTimeout: requestTimeout
            }
          }
        })
      ],
      exports: [NestElasticsearchModule]
    }
  }
}
