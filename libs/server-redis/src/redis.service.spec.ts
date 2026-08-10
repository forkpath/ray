import type { Redis as RedisClient } from 'ioredis'

import { RedisService } from './redis.service'

describe('RedisService', () => {
  it('writes serializable hash fields and applies the requested TTL', async () => {
    const hset = vi.fn().mockReturnThis()
    const expire = vi.fn().mockReturnThis()
    const exec = vi.fn().mockResolvedValue([[null, 1]])
    const pipeline = vi.fn(() => ({ hset, expire, exec }))
    const del = vi.fn()
    const client = { del, pipeline } as unknown as RedisClient
    const service = new RedisService(client)

    await service.setObjectAsHash(
      'session:1',
      {
        name: 'Ada',
        preferences: { locale: 'en' },
        omitted: undefined
      },
      60
    )

    expect(hset).toHaveBeenCalledTimes(2)
    expect(hset).toHaveBeenNthCalledWith(1, 'session:1', 'name', 'Ada')
    expect(hset).toHaveBeenNthCalledWith(2, 'session:1', 'preferences', JSON.stringify({ locale: 'en' }))
    expect(expire).toHaveBeenCalledWith('session:1', 60)
    expect(exec).toHaveBeenCalledOnce()
    expect(del).not.toHaveBeenCalled()
  })

  it('deletes the key instead of issuing an empty hash pipeline', async () => {
    const pipeline = vi.fn()
    const del = vi.fn().mockResolvedValue(1)
    const client = { del, pipeline } as unknown as RedisClient
    const service = new RedisService(client)

    await service.setObjectAsHash('session:empty', {})

    expect(del).toHaveBeenCalledWith('session:empty')
    expect(pipeline).not.toHaveBeenCalled()
  })
})
