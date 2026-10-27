import { useEffect } from 'react'
import { XIcon } from './Icons'

export interface ToastMessage {
  id: number
  type: 'error' | 'info'
  text: string
}

interface ToastProps {
  toast: ToastMessage
  onDismiss: () => void
}

export function Toast({ toast, onDismiss }: ToastProps): React.JSX.Element {
  // Tự ẩn sau 5 giây
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div className={`toast toast-${toast.type}`} role="alert">
      <span>{toast.text}</span>
      <button className="toast-close" onClick={onDismiss} title="Đóng">
        <XIcon width={14} height={14} />
      </button>
    </div>
  )
}
