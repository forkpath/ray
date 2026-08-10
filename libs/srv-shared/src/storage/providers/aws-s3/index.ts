import type { StorageConfig } from '@libs/server-kernel'

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { StoragePolicyResponse, StorageProvider } from '../types'

export const createStorageProvider = (config: StorageConfig): StorageProvider => {
  if (!config?.accessKeyId || !config.accessKeySecret || !config.region || !config.bucket) {
    throw new Error('AWS S3 config is missing')
  }

  const client = new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.accessKeySecret
    },
    endpoint: config.endpoint
  })

  return {
    /**
     * S3 本身没有像 OSS “callback” 那样的上传完成后由 S3 主动回调你的 HTTP 接口的能力
     * S3 在对象发生事件时（如 ObjectCreated:*、ObjectRemoved:*）自动发出通知
     * Lambda：S3 直接调用你的 Lambda 函数（最像“回调”，但函数在 AWS 内）
     * 如果必须回调你的服务：常见做法是 Lambda 收到事件后再调用你的 HTTP API
     */
    async getPolicy(dir: string): Promise<StoragePolicyResponse> {
      const key = dir

      // S3 这里使用预签名 PUT URL，字段与 OSS 不完全一致；dir 视为完整的 key。
      const signedUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key
        }),
        { expiresIn: 60 * 60 * 24 }
      )

      const url = new URL(signedUrl)
      return {
        expire: String(Math.floor(Date.now() / 1000) + 60 * 60 * 24),
        policy: signedUrl,
        signature: '',
        accessid: config.accessKeyId,
        host: `${url.protocol}//${url.host}`,
        callback: '',
        dir: key
      }
    },

    async getObjectUrl(key: string) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key
        }),
        { expiresIn: 60 * 60 }
      )
    },

    async putObject(key: string, body: Buffer) {
      return client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body
        })
      )
    },

    async getObject(key: string) {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key
        })
      )

      if (!result.Body) {
        return Buffer.from('')
      }

      return streamToBuffer(result.Body)
    },

    async copyObject(sourceKey: string, targetKey: string) {
      const copySource = `${config.bucket}/${encodeURIComponent(sourceKey)}`
      await client.send(
        new CopyObjectCommand({
          Bucket: config.bucket,
          CopySource: copySource,
          Key: targetKey
        })
      )
    },

    async deleteObject(key: string) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: key
        })
      )
    },

    async deleteObjects(keys: string[]) {
      if (keys.length === 0) {
        return
      }

      await client.send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: {
            Objects: keys.map(key => ({ Key: key }))
          }
        })
      )
    },

    async listObjects() {
      const result = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket
        })
      )
      return (result.Contents ?? []).map(obj => obj.Key ?? '').filter(Boolean)
    },

    async deleteDir(dirPrefix: string) {
      let continuationToken: string | undefined

      do {
        const listResult = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: dirPrefix,
            ContinuationToken: continuationToken,
            MaxKeys: 1000
          })
        )

        const keys = (listResult.Contents ?? []).map(obj => obj.Key).filter((key): key is string => Boolean(key))

        if (keys.length > 0) {
          await client.send(
            new DeleteObjectsCommand({
              Bucket: config.bucket,
              Delete: {
                Objects: keys.map(key => ({ Key: key })),
                Quiet: true
              }
            })
          )
        }

        continuationToken = listResult.NextContinuationToken
      } while (continuationToken)
    }
  }
}

const streamToBuffer = async (body: unknown): Promise<Buffer> => {
  if (body instanceof Uint8Array) {
    return Buffer.from(body)
  }

  if (typeof body === 'string') {
    return Buffer.from(body)
  }

  if (!body || typeof (body as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] !== 'function') {
    return Buffer.from('')
  }

  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}
