import { useEffect } from 'react'
import './Toast.css'

interface ToastProps {
  message: string
  onDismiss: () => void
  duration?: number
  onUndo?: () => void
  undoLabel?: string
}

export function Toast({ message, onDismiss, duration = 3000, onUndo, undoLabel = 'Undo' }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [onDismiss, duration])

  return (
    <div className="toast">
      <span>{message}</span>
      {onUndo && (
        <button
          type="button"
          className="toast-undo"
          onClick={() => { onUndo(); onDismiss() }}
        >
          {undoLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="toast-dismiss"
      >
        ✕
      </button>
    </div>
  )
}
