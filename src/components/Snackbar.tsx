'use client'

import { useEffect } from 'react'
import Icon from '@mdi/react'
import { mdiClose } from '@mdi/js'

export type SnackbarStatus = 'success' | 'error' | 'warning'

type SnackbarProps = {
  open: boolean
  status: SnackbarStatus
  message: string
  onClose: () => void
  durationMs?: number
}

const ICON_SIZE = 0.8

function Snackbar({ open, status, message, onClose, durationMs = 3000 }: SnackbarProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      onClose()
    }, durationMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [open, durationMs, onClose])

  if (!open || !message) {
    return null
  }

  const liveMode = status === 'error' ? 'assertive' : 'polite'

  return (
    <div className="snackbar-container" aria-live={liveMode}>
      <div className={`snackbar snackbar-${status}`} role="status">
        <span className="snackbar-message">{message}</span>
        <button
          type="button"
          className="snackbar-close"
          aria-label="Fechar"
          onClick={onClose}
        >
          <Icon path={mdiClose} size={ICON_SIZE} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

export default Snackbar
