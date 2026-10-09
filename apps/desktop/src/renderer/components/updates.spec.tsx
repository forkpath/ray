// @vitest-environment jsdom
import type { ReactNode } from 'react'
import type { UpdateState } from '~/shared/updates'

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Updates } from './updates'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@libs/ui-web', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Progress: ({ value }: { value: number }) => <progress value={value} max={100} />
}))
afterEach(cleanup)

describe('update panel actions', () => {
  it.each([
    ['unconfigured', undefined, undefined],
    ['idle', undefined, 'check'],
    ['checking', undefined, undefined],
    ['not-available', undefined, 'check'],
    ['available', undefined, 'download'],
    ['downloading', undefined, undefined],
    ['downloaded', undefined, 'restart'],
    ['error', 'check-failed', 'check'],
    ['error', 'download-failed', 'download']
  ] as const)('exposes only valid actions for %s %s', async (status, error, action) => {
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        updates: {
          getState: async () => ({ currentVersion: '1.0.0', status, error, percent: 42 }),
          onStateChange: () => () => undefined
        }
      }
    })
    render(<Updates />)
    await screen.findByText(`desktopUpdates.states.${status}`)
    for (const name of ['check', 'download', 'restart']) {
      expect(Boolean(screen.queryByText(`desktopUpdates.${name}`))).toBe(name === action)
    }
    if (status === 'downloading') expect(screen.getByText('42%')).toBeTruthy()
  })

  it('requires explicit download/install and removes subscriptions on unmount', async () => {
    let listener: (state: UpdateState) => void = () => undefined
    const off = vi.fn()
    const download = vi.fn(
      async (): Promise<UpdateState> => ({ status: 'downloading', currentVersion: '1.0.0', percent: 0 })
    )
    const install = vi.fn(async (): Promise<UpdateState> => ({ status: 'downloaded', currentVersion: '1.0.0' }))
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {
        updates: {
          getState: async () => ({ status: 'available', currentVersion: '1.0.0', version: '1.1.0' }),
          check: vi.fn(),
          download,
          install,
          onStateChange: (callback: typeof listener) => {
            listener = callback
            return off
          }
        }
      }
    })
    const view = render(<Updates />)
    await screen.findByText('desktopUpdates.download')
    expect(download).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('desktopUpdates.download'))
    await waitFor(() => expect(download).toHaveBeenCalledOnce())
    await act(async () => listener({ status: 'downloaded', currentVersion: '1.0.0', version: '1.1.0' }))
    expect(install).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('desktopUpdates.restart'))
    await waitFor(() => expect(install).toHaveBeenCalledOnce())
    view.unmount()
    expect(off).toHaveBeenCalledOnce()
  })
})
