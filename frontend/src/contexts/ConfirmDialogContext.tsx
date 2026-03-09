import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { ConfirmDialog, ConfirmOptions } from '../components/ui/ConfirmDialog'

interface ConfirmDialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null)

interface DialogState extends ConfirmOptions {
  isOpen: boolean
}

const CLOSED_STATE: DialogState = {
  isOpen: false,
  title: '',
  message: '',
}

export const ConfirmDialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [dialog, setDialog] = useState<DialogState>(CLOSED_STATE)
  // Hold a ref to the resolve function of the pending promise
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setDialog({ ...options, isOpen: true })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setDialog(CLOSED_STATE)
    resolveRef.current?.(true)
    resolveRef.current = null
  }, [])

  const handleCancel = useCallback(() => {
    setDialog(CLOSED_STATE)
    resolveRef.current?.(false)
    resolveRef.current = null
  }, [])

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        variant={dialog.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmDialogContext.Provider>
  )
}

export const useConfirmDialog = (): ConfirmDialogContextType => {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) {
    throw new Error('useConfirmDialog must be used inside ConfirmDialogProvider')
  }
  return ctx
}
