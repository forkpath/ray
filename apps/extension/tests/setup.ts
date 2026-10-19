import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { fakeBrowser } from 'wxt/testing/fake-browser'

// Stub only `chrome`. @webext-core/messaging loads webextension-polyfill, which wraps a
// Chrome-style API so listeners can return promises, as in a real browser. A global
// `browser` makes the polyfill skip that wrapper, and fake-browser 2 (WXT 0.21) follows
// Chrome's sendResponse contract, so promise-returning handlers would get no response.
vi.stubGlobal('chrome', fakeBrowser)

beforeEach(() => fakeBrowser.reset())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
