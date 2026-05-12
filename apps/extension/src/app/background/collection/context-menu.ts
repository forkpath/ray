import type { CachedCategories } from '~/lib/storage'

import { apiClient } from '~/lib/api'
import { Message, onMessage, sendMessage } from '~/lib/messaging'
import { getStorage, StorageKey } from '~/lib/storage'

import { logger, VideoPlatform } from '@libs/common'

// ==================== Platform Detection ====================

const PLATFORM_HOST_MAP: Record<string, string> = {
  'youtube.com': VideoPlatform.YOUTUBE,
  'youtu.be': VideoPlatform.YOUTUBE,
  'x.com': VideoPlatform.X,
  'twitter.com': VideoPlatform.X,
  'xiaohongshu.com': VideoPlatform.XIAOHONGSHU,
  'bilibili.com': VideoPlatform.BILIBILI,
  'weibo.com': VideoPlatform.WEIBO,
  'mp.weixin.qq.com': VideoPlatform.WECHAT_MP,
  'tiktok.com': VideoPlatform.TIKTOK,
  'douyin.com': VideoPlatform.DOUYIN,
  'kuaishou.com': VideoPlatform.KUAISHOU,
  'ksapp.com': VideoPlatform.KUAISHOU
}

const VIDEO_URL_PATTERNS = Object.keys(PLATFORM_HOST_MAP).map(host => `*://*.${host}/*`)

// ==================== Category Cache ====================

async function fetchAndCacheCategories(): Promise<CachedCategories['list']> {
  try {
    const res = await apiClient.get<{ list: CachedCategories['list'] }>('/collections/categories')
    const data: CachedCategories = { list: res.list, fetchedAt: Date.now() }
    await getStorage(StorageKey.CATEGORIES).setValue(data)
    return res.list
  } catch (err) {
    logger.warn('Failed to fetch collection categories', err)
    const cached = await getStorage(StorageKey.CATEGORIES).getValue()
    return cached?.list ?? []
  }
}

// ==================== Menu Creation ====================

const MENU_ID = {
  SAVE_IMAGE_PARENT: 'pf-save-image',
  SAVE_VIDEO_PARENT: 'pf-save-video',
  SAVE_TEXT_PARENT: 'pf-save-text'
} as const

async function buildContextMenus(categories: CachedCategories['list']) {
  await chrome.contextMenus.removeAll()

  if (categories.length === 0) return

  chrome.contextMenus.create({
    id: MENU_ID.SAVE_IMAGE_PARENT,
    title: '保存图片到 postfly',
    contexts: ['image'],
    icons: { 16: 'icon/16.png' }
  })

  chrome.contextMenus.create({
    id: MENU_ID.SAVE_VIDEO_PARENT,
    title: '保存视频到 postfly',
    contexts: ['page'],
    documentUrlPatterns: VIDEO_URL_PATTERNS,
    icons: { 16: 'icon/16.png' }
  })

  chrome.contextMenus.create({
    id: MENU_ID.SAVE_TEXT_PARENT,
    title: '保存文字到 postfly',
    contexts: ['selection'],
    icons: { 16: 'icon/16.png' }
  })

  for (const category of categories) {
    chrome.contextMenus.create({
      id: `image:${category.id}`,
      parentId: MENU_ID.SAVE_IMAGE_PARENT,
      title: category.name,
      contexts: ['image']
    })
    chrome.contextMenus.create({
      id: `video:${category.id}`,
      parentId: MENU_ID.SAVE_VIDEO_PARENT,
      title: category.name,
      contexts: ['page'],
      documentUrlPatterns: VIDEO_URL_PATTERNS
    })
    chrome.contextMenus.create({
      id: `text:${category.id}`,
      parentId: MENU_ID.SAVE_TEXT_PARENT,
      title: category.name,
      contexts: ['selection']
    })
  }
}

// ==================== Click Handler ====================

async function toastTab(tabId: number | undefined, payload: { type: 'success' | 'error' | 'info'; message: string }) {
  if (tabId === undefined) return
  try {
    await sendMessage(Message.SHOW_TOAST, payload, tabId)
  } catch {
    // content script may not be injected on all pages
  }
}

async function handleMenuClick(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab | undefined) {
  const menuId = String(info.menuItemId)
  if (!menuId.includes(':')) return

  const [type, categoryId] = menuId.split(':') as ['image' | 'video' | 'text', string]
  const pageUrl = tab?.url ?? info.pageUrl ?? ''
  const pageTitle = tab?.title ?? undefined
  const tabId = tab?.id

  if (type === 'image') {
    const imageUrl = info.srcUrl
    if (!imageUrl) return
    try {
      await apiClient.post('/collections/items', {
        type: 'image',
        categoryId,
        imageUrl,
        sourceUrl: pageUrl,
        title: pageTitle
      })
      await toastTab(tabId, { type: 'success', message: '图片已保存到 postfly' })
    } catch {
      await toastTab(tabId, { type: 'error', message: '保存失败，请稍后重试' })
    }
    return
  }

  if (type === 'text') {
    if (!tabId) return
    let rawContent: string | null = null
    try {
      rawContent = await sendMessage(Message.EXTRACT_SELECTION_HTML, undefined, tabId)
    } catch {
      // content script unavailable, fall back to plain text
    }

    // Wrap plain text as HTML paragraph if HTML extraction failed
    if (!rawContent) {
      const selectionText = info.selectionText
      if (!selectionText) return
      rawContent = `<p>${selectionText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
    }

    try {
      await apiClient.post('/collections/items', {
        type: 'rich_text',
        categoryId,
        rawContent,
        sourceUrl: pageUrl,
        title: pageTitle
      })
      await toastTab(tabId, { type: 'success', message: '文字已保存到 postfly，AI 处理中' })
    } catch {
      await toastTab(tabId, { type: 'error', message: '保存失败，请稍后重试' })
    }
    return
  }

  if (type === 'video') {
    const pageHost = (() => {
      try {
        return new URL(pageUrl).hostname
      } catch {
        return ''
      }
    })()
    const platform = Object.entries(PLATFORM_HOST_MAP).find(([host]) => pageHost.endsWith(host))?.[1]
    if (!platform) {
      await toastTab(tabId, { type: 'error', message: '不支持的视频平台' })
      return
    }

    let itemId: string | undefined
    try {
      const item = await apiClient.post<{ id: string }>('/collections/items', {
        type: 'video',
        categoryId,
        platform,
        sourceUrl: pageUrl,
        title: pageTitle,
        downloadStatus: 'pending'
      })
      itemId = item.id
    } catch {
      await toastTab(tabId, { type: 'error', message: '保存失败，请稍后重试' })
      return
    }

    let videoUrl: string | null = null
    if (tabId !== undefined) {
      try {
        videoUrl = await sendMessage(Message.EXTRACT_VIDEO_URL, undefined, tabId)
      } catch {
        // content script unavailable or extraction not supported
      }
    }

    if (videoUrl) {
      try {
        const filename = `${pageTitle ?? 'video'}.mp4`.replace(/[/\\?%*:|"<>]/g, '-')
        await chrome.downloads.download({ url: videoUrl, filename })
        await apiClient.patch(`/collections/items/${itemId}`, { downloadStatus: 'completed' })
        await toastTab(tabId, { type: 'success', message: '视频已开始下载并保存到 postfly' })
      } catch {
        await apiClient.patch(`/collections/items/${itemId}`, { downloadStatus: 'failed' })
        await toastTab(tabId, { type: 'error', message: '视频链接已保存，下载启动失败' })
      }
    } else {
      await apiClient.patch(`/collections/items/${itemId}`, { downloadStatus: 'unavailable' })
      await toastTab(tabId, { type: 'info', message: '链接已保存，该平台暂不支持自动下载' })
    }
  }
}

// ==================== Init ====================

export async function initCollectionContextMenu() {
  const categories = await fetchAndCacheCategories()
  await buildContextMenus(categories)
  chrome.contextMenus.onClicked.addListener(handleMenuClick)

  // Rebuild menus when the user switches workspace in the popup
  onMessage(Message.WORKSPACE_CHANGED, async () => {
    const fresh = await fetchAndCacheCategories()
    await buildContextMenus(fresh)
  })
}

export { fetchAndCacheCategories, buildContextMenus }
