import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { ToastContainer, ToastItem, ToastType } from '../components/ui/Toast'

interface ToastInput {
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastContextType {
  showToast: (toast: ToastInput) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const MAX_TOASTS = 5

let idCounter = 0
const nextId = () => `toast-${++idCounter}-${Date.now()}`

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((input: ToastInput) => {
    const item: ToastItem = { ...input, id: nextId() }
    setToasts((prev) => {
      const next = [...prev, item]
      // Remove oldest if over limit
      if (next.length > MAX_TOASTS) {
        return next.slice(next.length - MAX_TOASTS)
      }
      return next
    })
  }, [])

  const success = useCallback(
    (message: string, title?: string) => showToast({ type: 'success', message, title }),
    [showToast],
  )
  const error = useCallback(
    (message: string, title?: string) => showToast({ type: 'error', message, title }),
    [showToast],
  )
  const warning = useCallback(
    (message: string, title?: string) => showToast({ type: 'warning', message, title }),
    [showToast],
  )
  const info = useCallback(
    (message: string, title?: string) => showToast({ type: 'info', message, title }),
    [showToast],
  )

  // Memoise the context value so consumers don't see a new reference on
  // every provider render. Without this, ANY toast.error() triggers a state
  // update → provider re-render → new {} value → every consumer's useToast()
  // hook returns a fresh ref → any consumer with `toast` in a useCallback /
  // useEffect dep array recreates → its effect fires → if that effect calls
  // toast.error() again on failure (e.g. ContentBank load() retry on backend
  // error), we get an infinite loop of toasts.
  const value = useMemo<ToastContextType>(
    () => ({ showToast, success, error, warning, info }),
    [showToast, success, error, warning, info],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider')
  }
  return ctx
}
