import { defineExtensionMessaging } from '@webext-core/messaging'

export const Message = {
  HELLO: 'hello',
  EXTRACT_VIDEO_URL: 'extract-video-url',
  EXTRACT_SELECTION_HTML: 'extract-selection-html',
  SHOW_TOAST: 'show-toast',
  WORKSPACE_CHANGED: 'workspace-changed'
} as const

export type Message = (typeof Message)[keyof typeof Message]

export interface ToastPayload {
  type: 'success' | 'error' | 'info'
  message: string
}

interface Messages {
  [Message.HELLO]: (filename: string) => string
  [Message.EXTRACT_VIDEO_URL]: () => string | null
  [Message.EXTRACT_SELECTION_HTML]: () => string | null
  [Message.SHOW_TOAST]: (payload: ToastPayload) => void
  [Message.WORKSPACE_CHANGED]: () => void
}

export const { onMessage, sendMessage } = defineExtensionMessaging<Messages>()
