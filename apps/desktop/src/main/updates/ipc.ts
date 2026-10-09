import type { UpdateService } from './service'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

import { ipcMain } from 'electron'

import { updateChannels } from '~/shared/updates'

export function isTrustedUpdateSender(event: IpcMainInvokeEvent, window: BrowserWindow, trustedUrl: string): boolean {
  if (window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame)
    return false
  try {
    const actual = new URL(event.senderFrame.url)
    const expected = new URL(trustedUrl)
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      actual.origin === expected.origin &&
      actual.pathname === expected.pathname &&
      actual.search === expected.search
    )
  } catch {
    return false
  }
}

export function registerUpdateHandlers(window: BrowserWindow, service: UpdateService, trustedUrl: string) {
  const actions = {
    [updateChannels.getState]: service.getState,
    [updateChannels.check]: service.check,
    [updateChannels.download]: service.download,
    [updateChannels.install]: service.install
  }
  for (const [channel, action] of Object.entries(actions)) {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isTrustedUpdateSender(event, window, trustedUrl) || args.length) throw new Error('Invalid update request')
      return action()
    })
  }
  const unsubscribe = service.subscribe(state => {
    if (!window.isDestroyed() && !window.webContents.isDestroyed())
      window.webContents.send(updateChannels.changed, state)
  })
  const dispose = () => {
    unsubscribe()
    for (const channel of Object.keys(actions)) ipcMain.removeHandler(channel)
  }
  window.once('closed', dispose)
  return dispose
}
