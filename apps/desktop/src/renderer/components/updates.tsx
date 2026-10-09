import type { UpdateState } from '~/shared/updates'

import { useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Progress
} from '@libs/ui-web'

export function Updates() {
  const { t } = useTranslation('common')
  const [state, setState] = useState<UpdateState>()
  const [open, setOpen] = useState(false)
  const [bridgeError, setBridgeError] = useState(false)
  useEffect(() => {
    let active = true
    let receivedEvent = false
    const unsubscribe = window.electronAPI.updates.onStateChange(next => {
      receivedEvent = true
      if (!active) return
      setState(next)
      setBridgeError(false)
      if (next.status === 'available' || next.status === 'downloaded') setOpen(true)
    })
    void window.electronAPI.updates
      .getState()
      .then(next => {
        if (active && !receivedEvent) setState(next)
      })
      .catch(() => {
        if (active) setBridgeError(true)
      })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])
  const act = async (action: 'check' | 'download' | 'install') => {
    setBridgeError(false)
    try {
      setState(await window.electronAPI.updates[action]())
    } catch {
      setBridgeError(true)
    }
  }
  const download = state?.status === 'available' || (state?.status === 'error' && state.error === 'download-failed')
  const check = state && ['idle', 'not-available', 'error'].includes(state.status) && !download
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="fixed right-4 bottom-4 z-40" data-testid="updates-open">
          {t('desktopUpdates.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('desktopUpdates.title')}</DialogTitle>
          <DialogDescription>
            {t('desktopUpdates.current', { version: state?.currentVersion ?? '—' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2" aria-live="polite">
          <p data-testid="updates-status">{t(`desktopUpdates.states.${state?.status ?? 'idle'}`)}</p>
          {state?.version && (
            <p className="text-muted-foreground text-sm">
              {t('desktopUpdates.availableVersion', { version: state.version })}
            </p>
          )}
          {state?.status === 'downloading' && (
            <div className="space-y-2">
              <Progress value={state.percent ?? 0} aria-label={t('desktopUpdates.progress')} />
              <p className="text-muted-foreground text-sm tabular-nums">{Math.floor(state.percent ?? 0)}%</p>
            </div>
          )}
          {bridgeError && <p role="alert">{t('desktopUpdates.bridgeError')}</p>}
          {state?.status === 'downloaded' && (
            <p className="text-muted-foreground text-sm">{t('desktopUpdates.restartHint')}</p>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('desktopUpdates.later')}
          </Button>
          {(check || bridgeError) && <Button onClick={() => void act('check')}>{t('desktopUpdates.check')}</Button>}
          {download && <Button onClick={() => void act('download')}>{t('desktopUpdates.download')}</Button>}
          {state?.status === 'downloaded' && (
            <Button onClick={() => void act('install')}>{t('desktopUpdates.restart')}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
