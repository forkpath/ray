import { describe, expect, it } from 'vitest'

import { Message, onMessage, sendMessage } from '~/lib/messaging'

describe('extension messaging', () => {
  it('passes the typed payload through the registered handler', async () => {
    const remove = onMessage(Message.HELLO, ({ data }) => `received:${data}`)
    try {
      await expect(sendMessage(Message.HELLO, 'app/popup')).resolves.toBe('received:app/popup')
    } finally {
      remove()
    }
  })

  it('propagates a handler failure to the caller', async () => {
    const remove = onMessage(Message.HELLO, () => {
      throw new Error('Handler unavailable')
    })
    try {
      await expect(sendMessage(Message.HELLO, 'app/options')).rejects.toThrow('Handler unavailable')
    } finally {
      remove()
    }
  })
})
