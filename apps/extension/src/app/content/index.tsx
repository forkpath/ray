import ReactDOM from 'react-dom/client'
import { toast, Toaster } from 'sonner'
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root'
import { defineContentScript } from 'wxt/utils/define-content-script'

import '~/assets/styles/globals.css'

import { Message, onMessage } from '~/lib/messaging'

// ==================== Selection HTML Extraction ====================

function extractSelectionHtml(): string | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (range.collapsed) return null
  const fragment = range.cloneContents()
  const div = document.createElement('div')
  div.appendChild(fragment)
  return div.innerHTML || null
}

// ==================== Video URL Extraction ====================

function extractVideoUrl(): string | null {
  const host = window.location.hostname

  if (host.includes('bilibili.com')) {
    // Bilibili stores video info in window.__playinfo__
    const playinfo = (window as unknown as Record<string, unknown>).__playinfo__ as
      | { data?: { dash?: { video?: Array<{ baseUrl?: string }> } } }
      | undefined
    const url = playinfo?.data?.dash?.video?.[0]?.baseUrl
    return url ?? null
  }

  if (host.includes('weibo.com') || host.includes('mp.weixin.qq.com')) {
    // Try to find the first <video> element with a src
    const video = document.querySelector<HTMLVideoElement>('video[src]')
    return video?.src ?? null
  }

  // Generic fallback: first video element with a non-blob src
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
  for (const v of videos) {
    if (v.src && !v.src.startsWith('blob:')) return v.src
    const source = v.querySelector<HTMLSourceElement>('source[src]')
    if (source?.src && !source.src.startsWith('blob:')) return source.src
  }

  return null
}

// ==================== Toast UI ====================

const ToastHost = () => (
  <Toaster position="bottom-right" toastOptions={{ style: { fontFamily: 'system-ui, sans-serif' } }} />
)

// ==================== Content Script ====================

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    // Handle video URL extraction requests from background
    onMessage(Message.EXTRACT_VIDEO_URL, () => {
      return extractVideoUrl()
    })

    // Handle selection HTML extraction requests from background
    onMessage(Message.EXTRACT_SELECTION_HTML, () => {
      return extractSelectionHtml()
    })

    // Handle toast display requests from background
    onMessage(Message.SHOW_TOAST, ({ data }) => {
      if (data.type === 'success') toast.success(data.message)
      else if (data.type === 'error') toast.error(data.message)
      else toast.info(data.message)
    })

    // Mount shadow DOM for toast notifications
    const ui = await createShadowRootUi(ctx, {
      name: 'postfly-toast',
      position: 'overlay',
      anchor: 'body',
      onMount: container => {
        const app = document.createElement('div')
        container.append(app)
        const root = ReactDOM.createRoot(app)
        root.render(<ToastHost />)
        return root
      },
      onRemove: root => {
        root?.unmount()
      }
    })

    ui.mount()
  }
})
