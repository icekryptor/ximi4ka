import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X, Trash2, Download } from 'lucide-react'
import { unitEconomicsApi, CalculationGroup, ChannelConfig } from '../api/unitEconomics'

interface Props {
  isOpen: boolean
  onClose: () => void
  kitId: string | null
  onLoad: (channels: ChannelConfig[], groupId: string, groupName: string) => void
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const formatDate = (d: string) => {
  const date = new Date(d)
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const LoadCalculationModal = ({ isOpen, onClose, kitId, onLoad }: Props) => {
  const [groups, setGroups] = useState<CalculationGroup[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && kitId) {
      loadGroups()
    }
  }, [isOpen, kitId])

  const loadGroups = async () => {
    if (!kitId) return
    setLoading(true)
    try {
      const data = await unitEconomicsApi.getGroups(kitId)
      setGroups(data)
    } catch (err) {
      console.error('Ошибка загрузки расчётов:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (groupId: string) => {
    if (!confirm('Удалить расчёт со всеми каналами?')) return
    try {
      await unitEconomicsApi.deleteGroup(groupId)
      setGroups(prev => prev.filter(g => g.group_id !== groupId))
    } catch (err) {
      console.error('Ошибка удаления:', err)
    }
  }

  const handleLoad = async (group: CalculationGroup) => {
    try {
      const calcs = await unitEconomicsApi.getByGroup(group.group_id)
      const loadedChannels: ChannelConfig[] = calcs.map(calc => ({
        channel_name: calc.channel_name,
        seller_price: Number(calc.seller_price),
        ...(calc.start_price != null && { start_price: Number(calc.start_price) }),
        ...(calc.seller_discount != null && { seller_discount: Number(calc.seller_discount) }),
        ...(calc.marketplace_price != null && { marketplace_price: Number(calc.marketplace_price) }),
        cost_type: calc.cost_type,
        tax_rate: Number(calc.tax_rate),
        variable_blocks: calc.variable_blocks || [],
      }))
      onLoad(loadedChannels, group.group_id, group.name)
      onClose()
    } catch (err) {
      console.error('Ошибка загрузки группы:', err)
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
                <button onClick={onClose} className="text-brand-text-secondary hover:text-brand-text">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-4">
                {loading ? (
                  <div className="text-center py-8 text-brand-text-secondary">Загрузка...</div>
                ) : groups.length === 0 ? (
                  <div className="text-center py-8 text-brand-text-secondary">
                    Нет сохранённых расчётов для этого артикула
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-border">
                        <th className="text-left py-2 px-2 font-medium text-brand-text-secondary">Название</th>
                        <th className="text-left py-2 px-2 font-medium text-brand-text-secondary">Каналы</th>
                        <th className="text-right py-2 px-2 font-medium text-brand-text-secondary">Дата</th>
                        <th className="w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map(group => (
                        <tr
                          key={group.group_id}
                          className="border-b border-brand-border hover:bg-brand-surface transition-colors"
                        >
                          <td className="py-2 px-2 font-medium text-brand-text">{group.name}</td>
                          <td className="py-2 px-2">
                            <div className="flex flex-wrap gap-1">
                              {group.channels.map(ch => (
                                <span
                                  key={ch.channel_name}
                                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                    ch.profit >= 0
                                      ? 'bg-green-50 text-green-700'
                                      : 'bg-red-50 text-red-700'
                                  }`}
                                >
                                  {ch.channel_name}
                                  <span className="font-medium">{formatCurrency(ch.profit)} ₽</span>
                                  <span className="opacity-70">/ {ch.margin.toFixed(1)}%</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 px-2 text-right text-brand-text-secondary whitespace-nowrap">
                            {formatDate(group.updated_at)}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-end space-x-1">
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-primary-50 text-primary-600 transition-colors"
                                onClick={() => handleLoad(group)}
                                title="Загрузить"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                                onClick={() => handleDelete(group.group_id)}
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
