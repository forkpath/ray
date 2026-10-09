import type { UpdateState } from '~/shared/updates'

export interface UpdateEvents {
  available(version: string): void
  unavailable(): void
  progress(percent: number): void
  downloaded(version: string): void
  error(): void
}
export interface UpdatePort {
  check(): Promise<unknown>
  download(): Promise<unknown>
  install(): void
  listen(events: UpdateEvents): () => void
}

export class UpdateService {
  private state: UpdateState
  private pending?: Promise<UpdateState>
  private readonly listeners = new Set<(state: UpdateState) => void>()
  private readonly unlisten: () => void
  private disposed = false
  private installing = false

  constructor(
    private readonly port: UpdatePort,
    version: string,
    enabled: boolean
  ) {
    this.state = { currentVersion: version, status: enabled ? 'idle' : 'unconfigured' }
    this.unlisten = port.listen({
      available: version => this.set({ status: 'available', version }),
      unavailable: () => this.set({ status: 'not-available' }),
      progress: percent => {
        if (this.state.status === 'downloading')
          this.set({ status: 'downloading', version: this.state.version, percent: Math.max(0, Math.min(100, percent)) })
      },
      downloaded: version => this.set({ status: 'downloaded', version, percent: 100 }),
      error: () => this.fail()
    })
  }
  getState = (): UpdateState => ({ ...this.state })
  subscribe = (listener: (state: UpdateState) => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private set(next: Omit<UpdateState, 'currentVersion'>) {
    if (this.disposed || this.state.status === 'unconfigured') return
    this.state = { currentVersion: this.state.currentVersion, ...next }
    for (const listener of this.listeners) listener(this.getState())
  }
  private fail() {
    const downloading = this.state.status === 'downloading' || this.state.error === 'download-failed'
    this.set({
      status: 'error',
      error: downloading ? 'download-failed' : 'check-failed',
      version: downloading ? this.state.version : undefined
    })
  }
  check = (): Promise<UpdateState> => {
    if (this.pending) return this.pending
    if (this.disposed || ['unconfigured', 'downloaded'].includes(this.state.status))
      return Promise.resolve(this.getState())
    this.set({ status: 'checking' })
    this.pending = Promise.resolve()
      .then(() => this.port.check())
      .then(() => {
        if (this.state.status === 'checking') this.set({ status: 'not-available' })
      })
      .catch(() => this.fail())
      .then(this.getState)
      .finally(() => {
        this.pending = undefined
      })
    return this.pending
  }
  download = (): Promise<UpdateState> => {
    if (this.pending) return this.pending
    if (
      this.disposed ||
      !(this.state.status === 'available' || (this.state.status === 'error' && this.state.error === 'download-failed'))
    )
      return Promise.resolve(this.getState())
    this.set({ status: 'downloading', version: this.state.version, percent: 0 })
    this.pending = Promise.resolve()
      .then(() => this.port.download())
      .catch(() => this.fail())
      .then(this.getState)
      .finally(() => {
        this.pending = undefined
      })
    return this.pending
  }
  install = (): UpdateState => {
    if (!this.disposed && !this.installing && this.state.status === 'downloaded') {
      this.installing = true
      this.port.install()
    }
    return this.getState()
  }
  dispose() {
    this.disposed = true
    this.unlisten()
    this.listeners.clear()
  }
}
