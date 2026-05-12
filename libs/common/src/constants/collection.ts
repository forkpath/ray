export const CollectionItemType = {
  IMAGE: 'image',
  VIDEO: 'video',
  RICH_TEXT: 'rich_text'
} as const

export type CollectionItemType = (typeof CollectionItemType)[keyof typeof CollectionItemType]

export const AiProcessingStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const

export type AiProcessingStatus = (typeof AiProcessingStatus)[keyof typeof AiProcessingStatus]

export const VideoPlatform = {
  YOUTUBE: 'youtube',
  X: 'x',
  XIAOHONGSHU: 'xiaohongshu',
  BILIBILI: 'bilibili',
  WEIBO: 'weibo',
  WECHAT_MP: 'wechat_mp',
  TIKTOK: 'tiktok',
  DOUYIN: 'douyin',
  KUAISHOU: 'kuaishou'
} as const

export type VideoPlatform = (typeof VideoPlatform)[keyof typeof VideoPlatform]

export const VideoDownloadStatus = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  COMPLETED: 'completed',
  FAILED: 'failed',
  UNAVAILABLE: 'unavailable'
} as const

export type VideoDownloadStatus = (typeof VideoDownloadStatus)[keyof typeof VideoDownloadStatus]
