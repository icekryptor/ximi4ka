import { Fragment, useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { Dialog, Transition } from '@headlessui/react'
import { Supply, Counterparty, CounterpartyType } from '../api/types'
import { Component, componentsApi } from '../api/components'
import { counterpartiesApi } from '../api/counterparties'
import { suppliesApi, CreateSupplyData } from '../api/supplies'
import { formatCurrency } from '../utils/format'
import { useToast } from '../App'

interface SupplyModalProps {
  supply: Supply | null
  onClose: () => void
}

interface ItemForm {
  component_id: string
  quantity: number
  price_mode: 'unit' | 'total'
  entered_price: number
}

const emptyItem = (): ItemForm => ({
  component_id: '',
  quantity: 1,
  price_mode: 'total',
  entered_price: 0,
})

const SupplyModal = ({ supply, onClose }: SupplyModalProps) => {
  const { showToast } = useToast()
  const [formData, setFormData] = useState({
    supplier_id: supply?.supplier_id || '',
    carrier_id: supply?.carrier_id || '',
    delivery_cost: supply?.delivery_cost || 0,
    supply_date: supply?.supply_date
      ? String(supply.supply_date).split('T')[0]
      : new Date().toISOString().split('T')[0],
    notes: supply?.notes || '',
  })

  const [items, setItems] = useState<ItemForm[]>(
    supply?.items?.map((it) => ({
      component_id: it.component_id,
      quantity: Number(it.quantity),
      price_mode: it.price_mode as 'unit' | 'total',
      entered_price: Number(it.entered_price),
    })) || [emptyItem()]
  )

  const [components, setComponents] = useState<Component[]>([])
  const [counterparties, setCounterparties] = useState<Counterparty[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [comps, cps] = await Promise.all([
        componentsApi.getAll({ active: true }),
        counterpartiesApi.getAll(),
      ])
      setComponents(comps)
      setCounterparties(cps)
    } catch (error) {
      console.error('Ошибка загрузки справочников:', error)
    }
  }

  const suppliers = counterparties.filter(
    (c) => c.is_active && (c.type === CounterpartyType.SUPPLIER || c.type === CounterpartyType.BOTH)
  )
  const carriers = counterparties.filter(
    (c) => c.is_active && (c.type === CounterpartyType.CARRIER || c.type === CounterpartyType.BOTH)
  )

  const addItem = () => setItems([...items, emptyItem()])

  const removeItem = (idx: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: keyof ItemForm, value: any) => {
    setItems(items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }

  const calcItemTotal = (it: ItemForm) => {
    if (it.price_mode === 'unit') return it.entered_price * it.quantity
    return it.entered_price
  }

  const materialTotal = items.reduce((sum, it) => sum + calcItemTotal(it), 0)
  const grandTotal = materialTotal + Number(formData.delivery_cost || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validItems = items.filter((it) => it.component_id)
    if (validItems.length === 0) {
      showToast('Добавьте хотя бы одну позицию', 'error')
      return
    }

    setSaving(true)
    try {
      const payload: CreateSupplyData = {
        supplier_id: formData.supplier_id || undefined,
        carrier_id: formData.carrier_id || undefined,
        delivery_cost: Number(formData.delivery_cost) || 0,
        supply_date: formData.supply_date || undefined,
        notes: formData.notes || undefined,
        items: validItems.map((it) => ({
          component_id: it.component_id,
          quantity: Number(it.quantity),
          price_mode: it.price_mode,
          entered_price: Number(it.entered_price),
        })),
      }

      if (supply) {
        await suppliesApi.update(supply.id, payload)
      } else {
        await suppliesApi.create(payload)
      }
      onClose()
    } catch (error) {
      console.error('Ошибка сохранения поставки:', error)
      showToast('Не удалось сохранить поставку', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Transition show={true} as={Fragment}>
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
            <Dialog.Panel className="modal-panel max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-brand-border">
                <h2 className="text-2xl font-bold text-brand-text">
                  {supply ? 'Редактировать поставку' : 'Новая поставка'}
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-brand-surface rounded-lg transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Header fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Поставщик</label>
                    <select
                      className="input"
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    >
                      <option value="">— Без поставщика —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Перевозчик</label>
                    <select
                      className="input"
                      value={formData.carrier_id}
                      onChange={(e) => setFormData({ ...formData, carrier_id: e.target.value })}
                    >
                      <option value="">— Без перевозчика —</option>
                      {carriers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="label">Дата поставки</label>
                    <input
                      type="date"
                      className="input"
                      value={formData.supply_date}
                      onChange={(e) => setFormData({ ...formData, supply_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Стоимость доставки (₽)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input"
                      value={formData.delivery_cost}
                      onChange={(e) => setFormData({ ...formData, delivery_cost: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="label">Заметки</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Комментарий..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    />
                  </div>
                </div>

                {/* Items table */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-brand-text">Позиции</h3>
                    <button
                      type="button"
                      onClick={addItem}
                      className="btn btn-secondary flex items-center space-x-1 text-sm py-1.5 px-3"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Добавить</span>
                    </button>
                  </div>

                  <div className="border border-brand-border rounded-xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-brand-surface">
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-medium text-brand-text-secondary">Компонент</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-brand-text-secondary w-20">Кол-во</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-brand-text-secondary w-28">Режим цены</th>
                          <th className="text-center py-2 px-3 text-xs font-medium text-brand-text-secondary w-32">Цена (₽)</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-brand-text-secondary w-28">Итого</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-t border-gray-100">
                            <td className="py-2 px-3">
                              <select
                                className="input text-sm py-1.5"
                                value={item.component_id}
                                onChange={(e) => updateItem(idx, 'component_id', e.target.value)}
                              >
                                <option value="">— Выберите —</option>
                                {components.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} {c.sku ? `(${c.sku})` : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className="input text-sm py-1.5 text-center"
                                value={item.quantity}
                                onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="py-2 px-3">
                              <select
                                className="input text-sm py-1.5"
                                value={item.price_mode}
                                onChange={(e) => updateItem(idx, 'price_mode', e.target.value)}
                              >
                                <option value="total">За партию</option>
                                <option value="unit">За единицу</option>
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input text-sm py-1.5 text-right"
                                value={item.entered_price}
                                onChange={(e) => updateItem(idx, 'entered_price', parseFloat(e.target.value) || 0)}
                              />
                            </td>
                            <td className="py-2 px-3 text-right text-sm font-medium text-brand-text">
                              {formatCurrency(calcItemTotal(item))}
                            </td>
                            <td className="py-2 px-1">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="p-1 text-red-400 hover:text-red-600 transition-colors"
                                disabled={items.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-brand-surface rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-text-secondary">Материалы:</span>
                    <span className="font-medium">{formatCurrency(materialTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-brand-text-secondary">Доставка:</span>
                    <span className="font-medium">{formatCurrency(Number(formData.delivery_cost) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold border-t border-brand-border pt-2">
                    <span>Итого:</span>
                    <span className="text-primary-600">{formatCurrency(grandTotal)}</span>
                  </div>

                  {formData.supply_date && grandTotal > 0 && (
                    <div className="mt-3 pt-3 border-t border-brand-border">
                      <p className="text-xs font-medium text-brand-text-secondary mb-1">
                        Будут созданы транзакции:
                      </p>
                      {materialTotal > 0 && (
                        <p className="text-xs text-red-600">
                          • Расход {formatCurrency(materialTotal)} — Поставка материалов
                        </p>
                      )}
                      {Number(formData.delivery_cost) > 0 && (
                        <p className="text-xs text-red-600">
                          • Расход {formatCurrency(Number(formData.delivery_cost))} — Доставка
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-brand-border">
                  <button type="button" onClick={onClose} className="btn btn-secondary" disabled={saving}>
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Сохранение...' : supply ? 'Сохранить' : 'Создать поставку'}
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

export default SupplyModal
