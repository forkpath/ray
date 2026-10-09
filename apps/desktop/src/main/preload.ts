import type { ElectronWindowAPI } from './ipc-api'
import type { UpdateState } from '~/shared/updates'

import { contextBridge, ipcRenderer } from 'electron'

import { updateChannels } from '~/shared/updates'

contextBridge.exposeInMainWorld('electronAPI', {
  updates: {
    getState: () => ipcRenderer.invoke(updateChannels.getState),
    check: () => ipcRenderer.invoke(updateChannels.check),
    download: () => ipcRenderer.invoke(updateChannels.download),
    install: () => ipcRenderer.invoke(updateChannels.install),
    onStateChange: (callback: (state: UpdateState) => void) => {
      const listener = (_: Electron.IpcRendererEvent, state: UpdateState) => callback(state)
      ipcRenderer.on(updateChannels.changed, listener)
      return () => {
        ipcRenderer.removeListener(updateChannels.changed, listener)
      }
    }
  },
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  unmaximize: () => ipcRenderer.send('window:unmaximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, value: boolean) => callback(value)
    ipcRenderer.on('window:maximizeChanged', listener)
    return () => ipcRenderer.removeListener('window:maximizeChanged', listener)
  },
  platform: process.platform
} satisfies ElectronWindowAPI)
