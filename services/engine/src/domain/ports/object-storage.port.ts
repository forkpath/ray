export interface ObjectStorageUrl {
  readonly url: string
}

export interface IObjectStorage {
  getUploadUrl(path: string): Promise<ObjectStorageUrl>

  getDeleteUrl(path: string): Promise<ObjectStorageUrl>

  getSignedUrl(path: string): Promise<ObjectStorageUrl>

  getPublicUrl(path: string): ObjectStorageUrl
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE')
