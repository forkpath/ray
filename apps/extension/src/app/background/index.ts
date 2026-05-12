import { defineBackground } from 'wxt/utils/define-background'

import { logger } from '@libs/common'

import { initCollectionContextMenu } from './collection/context-menu'

import './messaging/hello'

const main = async () => {
  logger.info('Background service worker is running!')
  await initCollectionContextMenu()
}

export default defineBackground(main)
