export interface ServerConfig {
  enginePort: number
  corsOrigins: string
}

export interface RedisConfig {
  host: string
  port: number
  password: string
}

export interface MongoConfig {
  host: string
  port: number
  username: string
  password: string
  database: string
}

export interface CacheConfig extends RedisConfig {
  ttl: number
  db: number
}

export interface I18nConfig {
  fallbackLng: string
  localePath: string
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
export type LogFileSize = `${number}${'B' | 'K' | 'M' | 'G'}`
export type LogRotationInterval = `${number}${'M' | 'd' | 'h' | 'm' | 's'}`

export interface LoggerConfig {
  level: LogLevel
  scope: string
  fileEnabled: boolean
  fileSizeLimit: LogFileSize
  fileExpiredIn: LogRotationInterval
  compress: boolean
}

export interface ThrottlerRedisStorageConfig {
  type: 'redis'
  redis: RedisConfig & {
    db: number
  }
}

export interface ThrottlerMemoryStorageConfig {
  type: 'memory'
}

export interface ThrottlerConfig {
  ttl: number
  limit: number
  storage: ThrottlerMemoryStorageConfig | ThrottlerRedisStorageConfig
}

export interface StorageConfig {
  accessKeyId: string
  accessKeySecret: string
  region: string
  bucket: string
  endpoint?: string
}

export interface SmsConfig {
  accessKeyId: string
  accessKeySecret: string
  signName: string
}

export interface RabbitmqConfig {
  uri: string
  exchangeName: string
  exchangeType: 'direct' | 'topic' | 'fanout'
}

export interface ElasticsearchConfig {
  host: string
  port: number
  apiKey: string
  maxRetries: number
  requestTimeout: number
  dataIndex: string
}

export interface ServerRuntimeConfig {
  server: ServerConfig
  redis: RedisConfig
  mongo: MongoConfig
  cache: CacheConfig
  logger: LoggerConfig
  i18n: I18nConfig
  throttler: ThrottlerConfig
  storage: StorageConfig
  sms: SmsConfig
  rabbitmq: RabbitmqConfig
  elasticsearch: ElasticsearchConfig
}
