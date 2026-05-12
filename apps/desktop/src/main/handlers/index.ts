import { registerWindowHandlers } from '@main/handlers/windowHandlers'
import { BrowserWindow } from 'electron'

export function registerAllHandlers(window: BrowserWindow): void {
  registerWindowHandlers(window)
}
