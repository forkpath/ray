import { act, renderHook } from '@testing-library/react-native'
import * as Clipboard from 'expo-clipboard'

import { logger } from '@libs/common'

import { useCopyToClipboard } from '~/modules/common/hooks/use-copy-to-clipboard'

describe('useCopyToClipboard', () => {
  it('reports a successful native write and remembers the copied text', async () => {
    const write = jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true)
    const { result } = await renderHook(useCopyToClipboard)
    expect(result.current[0]).toBeNull()
    await act(async () => {
      expect(await result.current[1]('framework')).toBe(true)
    })
    expect(write).toHaveBeenCalledWith('framework')
    expect(result.current[0]).toBe('framework')
  })

  it('returns failure without replacing the last successful value', async () => {
    const failure = new Error('Clipboard unavailable')
    jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValueOnce(true).mockRejectedValueOnce(failure)
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined)
    const { result } = await renderHook(useCopyToClipboard)
    await act(async () => {
      await result.current[1]('previous')
    })
    await act(async () => {
      expect(await result.current[1]('failed')).toBe(false)
    })
    expect(result.current[0]).toBe('previous')
    expect(log).toHaveBeenCalledWith('Failed to copy to clipboard:', failure)
  })
})
