import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'

import { Redis as RedisClient } from 'ioredis' // 明确导入 RedisClient 类型

export const REDIS_CLIENT = Symbol('REDIS_CLIENT') // 使用 Symbol 作为注入令牌更安全，避免字符串冲突

@Injectable()
export class RedisService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(RedisService.name)
  private subscriberClient?: RedisClient

  constructor(@Inject(REDIS_CLIENT) private readonly redisClient: RedisClient) {}

  async onModuleInit() {
    if (!this.redisClient) {
      // 防御性编程，虽然在当前注入模式下不太可能发生
      this.logger.error('Redis client was not initialized correctly.')
      return
    }
    try {
      const pong = await this.redisClient.ping()
      if (pong === 'PONG') {
        this.logger.log('Successfully connected to Redis and received PONG.')
      } else {
        this.logger.warn('Connected to Redis, but PING did not return PONG.')
      }
    } catch (error) {
      this.logger.error('Failed to connect to Redis on module init.', error)
    }

    this.redisClient.on('error', error => {
      this.logger.error('Redis Client Error:', error.message, error.stack)
    })

    this.redisClient.on('connect', () => {
      this.logger.log('Redis client connected.')
    })

    this.redisClient.on('ready', () => {
      this.logger.log('Redis client ready.')
    })

    this.redisClient.on('reconnecting', () => {
      this.logger.warn('Redis client reconnecting...')
    })

    this.redisClient.on('close', () => {
      this.logger.warn('Redis client connection closed.')
    })

    this.redisClient.on('end', () => {
      this.logger.warn('Redis client connection ended (no more reconnections).')
    })
  }

  async onModuleDestroy() {
    if (this.subscriberClient && this.subscriberClient.status === 'ready') {
      await this.subscriberClient.quit()
      this.logger.log('Redis subscriber client connection closed.')
    }
    if (this.redisClient && this.redisClient.status === 'ready') {
      await this.redisClient.quit()
      this.logger.log('Redis client connection closed.')
    }
  }

  get client(): RedisClient {
    if (!this.redisClient) {
      throw new Error('Redis client is not available.')
    }
    return this.redisClient
  }

  get subClient(): RedisClient {
    if (!this.redisClient) {
      throw new Error('Main Redis client is not available to duplicate for subClient.')
    }
    if (!this.subscriberClient) {
      this.subscriberClient = this.redisClient.duplicate()
      this.subscriberClient.on('error', error => {
        this.logger.error('Redis Subscriber Client Error:', error.message, error.stack)
      })
      this.logger.log('Redis subscriber client duplicated.')
    }
    return this.subscriberClient
  }

  // HASH 操作方法
  // 1. setObjectAsHash: 对于空对象，当前是删除 key。可以考虑是否存一个特殊标记的空哈希，取决于业务需求。
  // 2. getObjectFromHash & getFieldFromHash: JSON.parse 的错误处理可以更细致，但当前做法是可接受的。
  // 3. 考虑pipeline的错误处理：pipeline.exec() 返回一个数组，每个元素是对应命令的结果或错误。
  async setObjectAsHash(key: string, obj: Record<string, unknown>, ttlSeconds?: number): Promise<void> {
    if (typeof obj !== 'object' || obj === null) {
      this.logger.warn(`setObjectAsHash: Input for key '${key}' is not a non-null object.`)
      // throw new Error('Input must be a non-null object.'); // 或者抛出错误
      return
    }
    if (Object.keys(obj).length === 0) {
      this.logger.log(`setObjectAsHash: Input object for key '${key}' is empty. Deleting key.`)
      await this.client.del(key)
      return
    }

    const pipeline = this.client.pipeline()
    for (const field in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, field)) {
        const value = obj[field]
        // 对于 undefined 值，JSON.stringify 后会消失，HSET 时可能不是期望的行为
        // 可以选择跳过 undefined，或者将其转换为空字符串或特定标记
        if (value === undefined) {
          // pipeline.hdel(key, field); // 如果希望删除该字段
          continue // 或者跳过
        }
        pipeline.hset(key, field, typeof value === 'string' ? value : JSON.stringify(value))
      }
    }
    if (ttlSeconds && ttlSeconds > 0) {
      pipeline.expire(key, ttlSeconds)
    }
    try {
      const results = await pipeline.exec()
      // 检查 pipeline 中是否有错误
      results?.forEach(([err], index) => {
        if (err) {
          this.logger.error(`Error in pipeline command ${index} for key '${key}':`, err)
        }
      })
    } catch (error) {
      this.logger.error(`Error executing pipeline for key '${key}':`, error)
      throw error // 根据需要重新抛出
    }
  }
}
