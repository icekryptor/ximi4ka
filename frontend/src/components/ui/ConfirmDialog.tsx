import { useEffect, useRef } from 'react'

export interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
}

interface ConfirmDialogProps extends ConfirmOptions {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    // Focus confirm button when opened
    const timer = setTimeout(() => {
      confirmRef.current?.focus()
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onConfirm, onCancel])

  if (!isOpen) return null

  const confirmButtonClass =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-300'
      : 'bg-primary-500 hover:bg-primary-600 text-white focus:ring-primary-300'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{
        animation: 'fadeIn 150ms ease forwards',
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div
        className="relative bg-white rounded-[32px] shadow-2xl max-w-md w-full p-8 flex flex-col gap-6"
        style={{
          animation: 'slideUp 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex items-center gap-4">
          {variant === 'danger' ? (
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-red-500">
                <path
                  d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.31 1.55 18.67 1.55 19.03C1.55 19.39 1.64 19.74 1.82 20.05C2 20.36 2.25 20.61 2.56 20.79C2.86 20.97 3.21 21.06 3.56 21.06H20.44C20.79 21.06 21.14 20.97 21.44 20.79C21.75 20.61 22 20.36 22.18 20.05C22.36 19.74 22.45 19.39 22.45 19.03C22.45 18.67 22.36 18.31 22.18 18L13.71 3.86C13.53 3.55 13.28 3.3 12.97 3.12C12.67 2.94 12.32 2.85 11.97 2.85C11.62 2.85 11.27 2.94 10.97 3.12C10.66 3.3 10.41 3.55 10.23 3.86L10.29 3.86Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : (
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary-500">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
          )}

          <div className="flex-1">
            <h2
              id="confirm-dialog-title"
              className="text-lg font-bold text-brand-text"
            >
              {title}
            </h2>
          </div>
        </div>

        {/* Message */}
        <p
          id="confirm-dialog-message"
          className="text-sm text-brand-text-secondary leading-relaxed -mt-2"
        >
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2.5 rounded-[32px] text-sm font-medium border border-brand-border text-brand-text-secondary hover:bg-brand-surface hover:text-brand-text transition-colors focus:outline-none focus:ring-2 focus:ring-brand-border"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`px-6 py-2.5 rounded-[32px] text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
