import type { MongoConfig } from '@libs/server-kernel'

import { DynamicModule, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose'

import { Connection } from 'mongoose'

import { InfographicDao } from './daos/infographic.dao'
import { NotificationDao } from './daos/notification.dao'
import { InfographicDoc, InfographicSchema } from './schemas/infographic.schema'
import { NotificationDoc, NotificationSchema } from './schemas/notification.schema'

const mongoFeatureSchemas = [
  {
    name: InfographicDoc.name,
    schema: InfographicSchema
  },
  {
    name: NotificationDoc.name,
    schema: NotificationSchema
  }
]

const mongoDaoProviders = [InfographicDao, NotificationDao]

function createMongoRootImport(): DynamicModule {
  return MongooseModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (configService: ConfigService): MongooseModuleOptions => {
      const conf = configService.get<MongoConfig>('mongo') as MongoConfig
      return {
        uri: `mongodb://${conf.username}:${encodeURIComponent(conf.password)}@${conf.host}:${conf.port}/${conf.database}`,
        connectionFactory: (connection: Connection): Connection => {
          if (connection instanceof Connection) {
            connection.set('retryWrites', true)
            connection.set('writeConcern', { w: 'majority' })
          }
          return connection
        },
        connectTimeoutMS: 5000
      }
    }
  })
}

@Module({})
export class MongoDaoModule {
  static forRoot(): DynamicModule {
    return {
      module: MongoDaoModule,
      imports: [createMongoRootImport()]
    }
  }

  static forFeature(): DynamicModule {
    return {
      module: MongoDaoModule,
      imports: [MongooseModule.forFeature(mongoFeatureSchemas)],
      providers: mongoDaoProviders,
      exports: [MongooseModule, ...mongoDaoProviders]
    }
  }

  static register(): DynamicModule {
    return {
      module: MongoDaoModule,
      imports: [createMongoRootImport(), MongooseModule.forFeature(mongoFeatureSchemas)],
      providers: mongoDaoProviders,
      exports: [MongooseModule, ...mongoDaoProviders]
    }
  }
}
