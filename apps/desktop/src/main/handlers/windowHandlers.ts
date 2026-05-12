import { BrowserWindow, ipcMain } from 'electron'

export function registerWindowHandlers(window: BrowserWindow): void {
  ipcMain.on('window:minimize', () => window.minimize())
  ipcMain.on('window:maximize', () => window.maximize())
  ipcMain.on('window:unmaximize', () => window.unmaximize())
  ipcMain.on('window:close', () => window.close())
  ipcMain.handle('window:isMaximized', () => window.isMaximized())

  window.on('maximize', () => window.webContents.send('window:maximizeChanged', true))
  window.on('unmaximize', () => window.webContents.send('window:maximizeChanged', false))

  // macOS 下 createWindow() 可能在 activate 事件后再次调用，
  // 必须在窗口销毁时清理 ipcMain 注册，防止 handle 重复注册报错
  window.on('closed', () => {
    ipcMain.removeHandler('window:isMaximized')
    ipcMain.removeAllListeners('window:minimize')
    ipcMain.removeAllListeners('window:maximize')
    ipcMain.removeAllListeners('window:unmaximize')
    ipcMain.removeAllListeners('window:close')
  })
}
