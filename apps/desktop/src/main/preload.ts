import type { ElectronWindowAPI } from './ipc-api'

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
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
