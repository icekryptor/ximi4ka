import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string) => void
  onUpdate: () => void
  onSaveAsNew: (name: string) => void
  loadedCalcId: string | null
  loadedCalcName: string
  hasChanges: boolean
}

const SaveCalculationModal = ({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  onSaveAsNew,
  loadedCalcId,
  loadedCalcName,
  hasChanges,
}: Props) => {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'new' | 'update' | 'clone'>('new')

  if (!isOpen) return null

  const isExisting = !!loadedCalcId

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isExisting && mode === 'update') {
      onUpdate()
    } else if (isExisting && mode === 'clone') {
      onSaveAsNew(name || `${loadedCalcName} (копия)`)
    } else {
      if (!name.trim()) return
      onSave(name.trim())
    }
    setName('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-brand-border">
          <h3 className="text-lg font-semibold text-brand-text">Сохранить расчёт</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {isExisting && hasChanges ? (
            <>
              <p className="text-sm text-brand-text-secondary">
                Расчёт «{loadedCalcName}» был изменён.
              </p>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="update"
                    checked={mode === 'update'}
                    onChange={() => setMode('update')}
                    className="text-primary-600"
                  />
                  <span className="text-sm">Обновить «{loadedCalcName}»</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="clone"
                    checked={mode === 'clone'}
                    onChange={() => setMode('clone')}
                    className="text-primary-600"
                  />
                  <span className="text-sm">Сохранить как новый</span>
                </label>
              </div>
              {mode === 'clone' && (
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Название нового расчёта"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-brand-text mb-1">
                  Название расчёта
                </label>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="Например: ВБ Химичка май 2026"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isExisting && !name.trim()}
            >
              {isExisting && mode === 'update' ? 'Обновить' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SaveCalculationModal
