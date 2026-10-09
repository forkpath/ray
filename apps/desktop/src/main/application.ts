import './instrument'

import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { app, BrowserWindow } from 'electron'

import { registerAllHandlers } from '~/main/handlers/index'

import { registerSmokeReport } from './smoke'
import { registerUpdateHandlers } from './updates/ipc'
import { createUpdateService } from './updates/runtime'

let updates: ReturnType<typeof createUpdateService>

let mainWindow: BrowserWindow | null = null

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'darwin' && {
      titleBarStyle: 'hidden',
      trafficLightPosition: { x: 16, y: 16 }
    }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    updates.start()
  })

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  registerAllHandlers(mainWindow)
  registerSmokeReport(mainWindow)

  const entry = path.join(__dirname, '../renderer/index.html')
  const devUrl = !app.isPackaged ? process.env.DESKTOP_DEV_URL : undefined
  const trustedUrl = devUrl || pathToFileURL(entry).href
  registerUpdateHandlers(mainWindow, updates.service, trustedUrl)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.split('#')[0] !== trustedUrl.split('#')[0]) event.preventDefault()
  })
  // Use the same encoding for loading and trust checks (for example Windows ~ paths).
  void mainWindow.loadURL(trustedUrl)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  updates = createUpdateService()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => updates?.dispose())
