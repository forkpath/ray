import { BrowserWindow } from 'electron'

import { registerWindowHandlers } from '~/main/handlers/windowHandlers'

export function registerAllHandlers(window: BrowserWindow): void {
  registerWindowHandlers(window)
}
