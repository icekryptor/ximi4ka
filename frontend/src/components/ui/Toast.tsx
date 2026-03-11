import { useEffect, useState } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastProps {
  toast: ToastItem
  onDismiss: (id: string) => void
}

const icons: Record<ToastType, JSX.Element> = {
  success: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="10" fill="currentColor" fillOpacity="0.15" />
      <path d="M6 10L9 13L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="10" fill="currentColor" fillOpacity="0.15" />
      <path d="M7 7L13 13M13 7L7 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.13 3.5L2.1 15.5A1 1 0 003 17H17a1 1 0 00.9-1.5L10.87 3.5a1 1 0 00-1.74 0Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 8V11M10 13.5V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="9" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9V14M10 6.5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

const typeStyles: Record<ToastType, { container: string; icon: string; bar: string }> = {
  success: {
    container: 'border-green-200 dark:border-green-800 bg-card',
    icon: 'text-green-500',
    bar: 'bg-green-500',
  },
  error: {
    container: 'border-red-200 dark:border-red-800 bg-card',
    icon: 'text-red-500',
    bar: 'bg-red-500',
  },
  warning: {
    container: 'border-amber-200 dark:border-amber-800 bg-card',
    icon: 'text-amber-500',
    bar: 'bg-amber-500',
  },
  info: {
    container: 'border-primary-200 dark:border-primary-800 bg-card',
    icon: 'text-primary-500',
    bar: 'bg-primary-500',
  },
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 4000,
  info: 4000,
  warning: 6000,
  error: 6000,
}

export const Toast = ({ toast, onDismiss }: ToastProps) => {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const dismissedRef = { current: false }
  const duration = toast.duration ?? DEFAULT_DURATION[toast.type]
  const styles = typeStyles[toast.type]

  useEffect(() => {
    let manualDismissTimer: ReturnType<typeof setTimeout> | null = null
    // Trigger enter animation on mount
    const enterTimer = setTimeout(() => setVisible(true), 10)
    // Trigger leave animation before actual dismiss
    const leaveTimer = setTimeout(() => {
      setLeaving(true)
    }, Math.max(0, duration - 400))
    const dismissTimer = setTimeout(() => {
      if (!dismissedRef.current) {
        dismissedRef.current = true
        onDismiss(toast.id)
      }
    }, duration)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(leaveTimer)
      clearTimeout(dismissTimer)
      if (manualDismissTimer) clearTimeout(manualDismissTimer)
    }
  }, [toast.id, duration, onDismiss])

  const handleDismiss = () => {
    if (dismissedRef.current) return
    setLeaving(true)
    setTimeout(() => {
      if (!dismissedRef.current) {
        dismissedRef.current = true
        onDismiss(toast.id)
      }
    }, 350)
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        transition: 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 350ms ease',
        transform: visible && !leaving ? 'translateX(0)' : 'translateX(110%)',
        opacity: visible && !leaving ? 1 : 0,
      }}
      className={`relative flex items-start gap-3 w-full max-w-sm rounded-2xl border shadow-lg px-4 py-3.5 overflow-hidden ${styles.container}`}
    >
      {/* Progress bar */}
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${styles.bar}`}
        style={{
          animation: `toast-progress ${duration}ms linear forwards`,
        }}
      />

      {/* Icon */}
      <span className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
        {icons[toast.type]}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-brand-text leading-tight mb-0.5">
            {toast.title}
          </p>
        )}
        <p className="text-sm text-brand-text-secondary leading-snug break-words">
          {toast.message}
        </p>
      </div>

      {/* Close button */}
      <button
        onClick={handleDismiss}
        aria-label="Закрыть уведомление"
        className="flex-shrink-0 mt-0.5 text-brand-text-secondary hover:text-brand-text transition-colors rounded p-0.5 hover:bg-black/5"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export const ToastContainer = ({ toasts, onDismiss }: ToastContainerProps) => {
  return (
    <div
      aria-label="Уведомления"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none"
      style={{ maxWidth: '384px', width: 'calc(100vw - 40px)' }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}
