import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
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
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95 translate-y-2"
            enterTo="opacity-100 scale-100 translate-y-0"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="modal-panel max-w-md">
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
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

export default SaveCalculationModal
