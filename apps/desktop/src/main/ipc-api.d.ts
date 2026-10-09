import type { UpdateAPI } from '~/shared/updates'

export interface ElectronWindowAPI {
  updates: UpdateAPI
  minimize: () => void
  maximize: () => void
  unmaximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void
  platform: NodeJS.Platform
}

declare global {
  interface Window {
    electronAPI: ElectronWindowAPI
  }
}
