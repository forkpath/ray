import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { logger } from '@libs/common'

import { ErrorBoundary } from '~/modules/common/error-boundary'

describe('extension ErrorBoundary', () => {
  it('renders healthy children', () => {
    render(
      <ErrorBoundary>
        <p>Extension ready</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('Extension ready')).toBeTruthy()
  })

  it('renders the recovery UI and records a rendering failure', () => {
    const failure = new Error('Render failed')
    const log = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const Broken = (): never => {
      throw failure
    }
    render(
      <ErrorBoundary fallback={<p role="alert">Try again</p>}>
        <Broken />
      </ErrorBoundary>
    )
    expect(screen.getByRole('alert').textContent).toBe('Try again')
    expect(log).toHaveBeenCalledWith(
      'Error boundary caught an error: ',
      failure,
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })
})
