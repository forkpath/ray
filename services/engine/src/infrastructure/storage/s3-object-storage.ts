import type { IObjectStorage, ObjectStorageUrl } from '~/domain/ports/object-storage.port'

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

@Injectable()
export class S3ObjectStorage implements IObjectStorage {
  private readonly client: S3Client
  private readonly bucket: string
  private readonly endpoint: string

  constructor(private readonly config: ConfigService) {
    const accessKeyId = this.config.get<string>('storage.accessKeyId', '')
    const secretAccessKey = this.config.get<string>('storage.accessKeySecret', '')
    const region = this.config.get<string>('storage.region', 'us-east-1')
    const endpoint = this.config.get<string>('storage.endpoint', '')
    this.bucket = this.config.get<string>('storage.bucket', 'ray')
    this.endpoint = endpoint

    const isCustomEndpoint = !!endpoint && !endpoint.includes('.amazonaws.com')

    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint ? { endpoint } : {}),
      ...(isCustomEndpoint ? { forcePathStyle: true } : {})
    })
  }

  async getUploadUrl(path: string): Promise<ObjectStorageUrl> {
    const url = await getSignedUrl(this.client, new PutObjectCommand({ Bucket: this.bucket, Key: path }), {
      expiresIn: 300
    })
    return { url }
  }

  getPublicUrl(path: string): ObjectStorageUrl {
    const url = this.endpoint
      ? `${this.endpoint}/${this.bucket}/${path}`
      : `https://${this.bucket}.s3.amazonaws.com/${path}`

    return { url }
  }

  async getDeleteUrl(path: string): Promise<ObjectStorageUrl> {
    const url = await getSignedUrl(this.client, new DeleteObjectCommand({ Bucket: this.bucket, Key: path }), {
      expiresIn: 300
    })
    return { url }
  }

  async getSignedUrl(path: string): Promise<ObjectStorageUrl> {
    const url = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: path }), {
      expiresIn: 3600
    })
    return { url }
  }
}
