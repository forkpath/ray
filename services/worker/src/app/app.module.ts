import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { MongoDaoModule } from '@libs/mongo-dao'
import { PgDaoModule } from '@libs/pg-dao'
import { RabbitmqModule } from '@libs/server-rabbitmq'

const workerConfig = () => ({
  mongo: {
    host: process.env['MONGO_HOST'] || 'localhost',
    port: parseInt(process.env['MONGO_PORT'] as string, 10) || 27017,
    username: process.env['MONGO_INITDB_ROOT_USERNAME'] || 'mongo_user',
    password: process.env['MONGO_INITDB_ROOT_PASSWORD'] || 'mongo_password',
    database: process.env['MONGO_INITDB_DATABASE'] || 'mongo_db'
  },
  rabbitmq: {
    uri: process.env['RABBITMQ_URI'] || 'amqp://localhost:5672',
    exchangeName: process.env['RABBITMQ_EXCHANGE_NAME'] || 'core',
    exchangeType: (process.env['RABBITMQ_EXCHANGE_TYPE'] as 'direct' | 'topic' | 'fanout') || 'direct'
  }
})

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [workerConfig]
    }),
    PgDaoModule.register(),
    MongoDaoModule.forRoot(),
    MongoDaoModule.forFeature(),
    RabbitmqModule.register()
  ],
  providers: []
})
export class AppModule {}
