import type { LogFileSize, LogLevel, LogRotationInterval, ServerRuntimeConfig } from '@libs/server-kernel'

import { APP_SLUG } from '@libs/common'

export type { ServerConfig } from '@libs/server-kernel'

const config: ServerRuntimeConfig = {
  server: {
    enginePort: parseInt(process.env['ENGINE_PORT'] as string, 10) || 6006,
    corsOrigins: process.env['CORS_ORIGINS'] || '*'
  },
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] as string, 10) || 6379,
    password: process.env['REDIS_PASSWORD'] || ''
  },
  mongo: {
    host: process.env['MONGO_HOST'] || 'localhost',
    port: parseInt(process.env['MONGO_PORT'] as string, 10) || 27017,
    username: process.env['MONGO_INITDB_ROOT_USERNAME'] || 'mongo_user',
    password: process.env['MONGO_INITDB_ROOT_PASSWORD'] || 'mongo_password',
    database: process.env['MONGO_INITDB_DATABASE'] || 'mongo_db'
  },
  cache: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] as string, 10) || 6379,
    password: process.env['REDIS_PASSWORD'] || '',
    ttl: parseInt(process.env['CACHE_TTL'] as string, 10) || 1000 * 60 * 60 * 2, // 2 hours
    db: parseInt(process.env['CACHE_DB_INDEX'] as string, 10) || 0
  },
  logger: {
    level: (process.env['LOGGER_LEVEL'] as LogLevel) || 'info',
    scope: process.env['LOGGER_SCOPE'] || 'neo',
    fileEnabled: (process.env['LOGGER_FILE_ENABLED'] as string).toLowerCase() === 'true',
    fileSizeLimit: (process.env['LOGGER_FILE_SIZE_LIMIT'] || '20M') as LogFileSize,
    fileExpiredIn: (process.env['LOGGER_FILE_EXPIRED_IN'] || '14d') as LogRotationInterval,
    compress: (process.env['LOGGER_FILE_COMPRESS'] as string).toLowerCase() === 'true'
  },
  i18n: {
    fallbackLng: process.env['DEFAULT_LOCALE'] || 'en',
    localePath: process.env['LOCALE_PATH'] || 'libs/i18n/src/translations'
  },
  throttler: {
    ttl: parseInt(process.env['THROTTLER_TTL'] as string, 10) || 60000, // 60秒
    limit: parseInt(process.env['THROTTLER_LIMIT'] as string, 10) || 10, // 最大请求数
    storage: {
      type: (process.env['THROTTLER_STORAGE'] as 'memory' | 'redis') || 'memory', // 存储方式
      redis: {
        host: process.env['REDIS_HOST'] || 'localhost',
        port: parseInt(process.env['REDIS_PORT'] as string, 10) || 6379,
        password: process.env['REDIS_PASSWORD'] || '',
        db: parseInt(process.env['THROTTLER_DB_INDEX'] as string, 10) || 2
      }
    }
  },
  storage: {
    accessKeyId: process.env['STORAGE_ACCESS_KEY_ID'] || 'storage_access_key_id',
    accessKeySecret: process.env['STORAGE_ACCESS_KEY_SECRET'] || 'storage_access_key_secret',
    bucket: process.env['STORAGE_BUCKET'] || APP_SLUG,
    region: process.env['STORAGE_REGION'] || 'us-east-1',
    endpoint: process.env['STORAGE_END_POINT'] || ''
  },
  sms: {
    accessKeyId: process.env['SMS_ACCESS_KEY_ID'] || 'sms_access_key_id',
    accessKeySecret: process.env['SMS_ACCESS_KEY_SECRET'] || 'sms_access_key_secret',
    signName: process.env['SMS_SIGN_NAME'] || 'sms_sign_name'
  },
  rabbitmq: {
    uri: process.env['RABBITMQ_URI'] || 'amqp://localhost:5672',
    exchangeName: process.env['RABBITMQ_EXCHANGE_NAME'] || 'core',
    exchangeType: (process.env['RABBITMQ_EXCHANGE_TYPE'] as 'direct' | 'topic' | 'fanout') || 'direct'
  },
  elasticsearch: {
    host: process.env['ELASTICSEARCH_HOST'] || 'localhost',
    port: parseInt(process.env['ELASTICSEARCH_PORT'] as string, 10) || 9200,
    apiKey: process.env['ELASTICSEARCH_API_KEY'] || 'elastic',
    maxRetries: parseInt(process.env['ELASTICSEARCH_MAX_RETRIES'] as string, 10) || 3,
    requestTimeout: parseInt(process.env['ELASTICSEARCH_REQUEST_TIMEOUT'] as string, 10) || 30000,
    dataIndex: process.env['ELASTICSEARCH_DATA_INDEX'] || 'neo_data'
  }
}

export const AppConfig = (): ServerRuntimeConfig => config
