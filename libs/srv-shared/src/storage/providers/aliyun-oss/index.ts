import type { StorageConfig } from '@libs/server-kernel'

import OSS, { PutObjectOptions } from 'ali-oss'
import dayjs from 'dayjs'

import { StorageProvider } from '../types'

export const createStorageProvider = (config: StorageConfig): StorageProvider => {
  if (!config?.accessKeyId || !config.accessKeySecret || !config.bucket || !config.region) {
    throw new Error('Aliyun OSS config is missing')
  }

  const client = new OSS({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    region: config.region,
    bucket: config.bucket,
    endpoint: config.endpoint
  })

  return {
    async getPolicy(dir: string, callbackUrl?: string, uid?: string) {
      const date = new Date()
      date.setDate(date.getDate() + 1)
      const policy = {
        expiration: date.toISOString(),
        conditions: [['content-length-range', 0, 1048576000]]
      }

      const formData = client.calculatePostSignature(policy)
      const host = `https://${config.bucket}.${config.region}.aliyuncs.com`.toString()

      let callback = ''
      if (callbackUrl && uid) {
        const callbackObj = {
          callbackUrl,
          callbackBody: `uid=${uid}&dir=${dir}&filename=$\{object}&size=$\{size}&mimeType=$\{mimeType}&height=$\{imageInfo.height}&width=$\{imageInfo.width}&belongs=$\{x:belongs}&name=$\{x:name}`,
          callbackBodyType: 'application/x-www-form-urlencoded'
        }
        callback = Buffer.from(JSON.stringify(callbackObj)).toString('base64')
      }

      return {
        expire: dayjs().add(1, 'days').unix().toString(),
        policy: formData.policy,
        signature: formData.Signature,
        accessid: formData.OSSAccessKeyId,
        host,
        callback,
        dir: dir.endsWith('/') ? dir : dir + '/'
      }
    },

    async getObjectUrl(key: string) {
      if (config.endpoint) {
        return client.generateObjectUrl(key, config.endpoint)
      }
      return client.generateObjectUrl(key)
    },

    async putObject(key: string, body: Buffer, options?: PutObjectOptions) {
      return client.put(key, body, options)
    },

    async getObject(key: string) {
      const result = await client.get(key)
      return result.content
    },

    async copyObject(sourceKey: string, targetKey: string) {
      await client.copy(targetKey, sourceKey, {
        headers: {
          'x-oss-copy-source-if-match': '*'
        }
      })
    },

    async deleteObject(key: string) {
      await client.delete(key)
    },

    async deleteObjects(keys: string[]) {
      await client.deleteMulti(keys)
    },

    async listObjects() {
      const result = await client.listV2({}, {})
      return result.objects.map(obj => obj.name)
    },

    async deleteDir(dirPrefix: string) {
      let cursor
      try {
        do {
          const listResult = await client.list(
            {
              prefix: dirPrefix,
              'max-keys': 1000,
              marker: cursor
            },
            {}
          )

          if (listResult.objects && listResult.objects.length > 0) {
            await client.deleteMulti(
              listResult.objects.map(obj => obj.name),
              { quiet: true }
            )
          }

          cursor = listResult.nextMarker
        } while (cursor)
      } catch (error) {
        console.error('批量删除oss中的文件失败', error)
      }
    }
  }
}
