import './ErrorMessage.css'

interface ErrorMessageProps {
  message: string
  onRetry: () => void
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="error-card">
      <p className="error-message">{message}</p>
      <button type="button" onClick={onRetry} className="btn-primary">
        Try again
      </button>
    </div>
  )
}
