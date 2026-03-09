import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Trash2, Download } from 'lucide-react'
import { unitEconomicsApi, UnitEconomicsCalculation } from '../api/unitEconomics'

interface Props {
  isOpen: boolean
  onClose: () => void
  kitId: string | null
  onLoad: (calc: UnitEconomicsCalculation) => void
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const formatDate = (d: string) => {
  const date = new Date(d)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const LoadCalculationModal = ({ isOpen, onClose, kitId, onLoad }: Props) => {
  const [calculations, setCalculations] = useState<UnitEconomicsCalculation[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && kitId) {
      loadCalculations()
    }
  }, [isOpen, kitId])

  const loadCalculations = async () => {
    if (!kitId) return
    setLoading(true)
    try {
      const data = await unitEconomicsApi.getAll(kitId)
      setCalculations(data)
    } catch (err) {
      console.error('Ошибка загрузки расчётов:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить расчёт?')) return
    try {
      await unitEconomicsApi.delete(id)
      setCalculations(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      console.error('Ошибка удаления:', err)
    }
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
            <Dialog.Panel className="modal-panel max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-brand-border">
                <h3 className="text-lg font-semibold text-brand-text">Загрузить расчёт</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {loading ? (
                  <div className="text-center py-8 text-brand-text-secondary">Загрузка...</div>
                ) : calculations.length === 0 ? (
                  <div className="text-center py-8 text-brand-text-secondary">
                    Нет сохранённых расчётов для этого артикула
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-border">
                        <th className="text-left py-2 px-2 font-medium text-brand-text-secondary">Название</th>
                        <th className="text-left py-2 px-2 font-medium text-brand-text-secondary">Канал</th>
                        <th className="text-right py-2 px-2 font-medium text-brand-text-secondary">Прибыль</th>
                        <th className="text-right py-2 px-2 font-medium text-brand-text-secondary">Маржа</th>
                        <th className="text-right py-2 px-2 font-medium text-brand-text-secondary">Дата</th>
                        <th className="w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {calculations.map(calc => (
                        <tr
                          key={calc.id}
                          className="border-b border-gray-100 hover:bg-brand-surface transition-colors"
                        >
                          <td className="py-2 px-2 font-medium text-brand-text">{calc.name}</td>
                          <td className="py-2 px-2 text-brand-text-secondary">{calc.channel_name}</td>
                          <td className={`py-2 px-2 text-right font-medium ${Number(calc.profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(Number(calc.profit))} ₽
                          </td>
                          <td className={`py-2 px-2 text-right ${Number(calc.margin) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {Number(calc.margin).toFixed(1)}%
                          </td>
                          <td className="py-2 px-2 text-right text-brand-text-secondary">
                            {formatDate(calc.updated_at)}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-primary-50 text-primary-600 transition-colors"
                                onClick={() => { onLoad(calc); onClose() }}
                                title="Загрузить"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                                onClick={() => handleDelete(calc.id)}
                                title="Удалить"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="p-4 border-t border-brand-border flex justify-end">
                <button onClick={onClose} className="btn btn-secondary">
                  Закрыть
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}

export default LoadCalculationModal
